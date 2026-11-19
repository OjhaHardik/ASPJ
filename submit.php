<?php
/**
 * Allenhouse admission enquiry handler.
 * Receives the enquiry form (JSON or regular form POST), validates it,
 * and appends one row to data/enquiries.csv.
 *
 * Requirements: PHP 7.2+ hosting, and the data/ folder must be writable
 * by the web server (chmod 755 or 775 on most cPanel hosts).
 */

declare(strict_types=1);

date_default_timezone_set('Asia/Kolkata'); // timestamps in IST

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const CSV_FILE = __DIR__ . '/data/enquiries.csv';
const CSV_HEADER = ['submitted_at', 'first_name', 'last_name', 'class', 'whatsapp (+91)', 'email', 'consent', 'session', 'source', 'page_url', 'ip_address', 'user_agent'];
const CLASSES = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}

/** Stop spreadsheet formula injection when the CSV is opened in Excel / Sheets. */
function csv_safe(string $value): string
{
    $value = trim(preg_replace('/[\r\n\t]+/', ' ', $value));
    if ($value !== '' && strpos('=+-@', $value[0]) !== false) {
        $value = "'" . $value;
    }
    return $value;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['success' => false, 'message' => 'Method not allowed']);
}

$raw = file_get_contents('php://input', false, null, 0, 20000);
$input = json_decode((string) $raw, true);
if (!is_array($input)) {
    $input = $_POST;
}

$get = function (string $key) use ($input): string {
    return isset($input[$key]) && is_scalar($input[$key]) ? trim((string) $input[$key]) : '';
};

// Honeypot: real visitors never fill this. Report success, store nothing.
if ($get('website') !== '') {
    respond(200, ['success' => true]);
}

$first = mb_substr($get('first_name') ?: $get('firstName'), 0, 60);
$last = mb_substr($get('last_name') ?: $get('lastName'), 0, 60);
$class = $get('class') ?: $get('grade');
$phone = preg_replace('/\D/', '', $get('whatsapp'));
if (strlen($phone) === 12 && strpos($phone, '91') === 0) {
    $phone = substr($phone, 2);
}
$email = mb_substr($get('email'), 0, 120);
$consentRaw = $input['consent'] ?? '';
$consent = $consentRaw === true || $consentRaw === 'yes' || $consentRaw === 'true' || $consentRaw === '1';

$errors = [];
if ($first === '') $errors['firstName'] = 'Please enter the first name.';
if ($last === '') $errors['lastName'] = 'Please enter the last name.';
if (!in_array($class, CLASSES, true)) $errors['grade'] = 'Please select a class.';
if (!preg_match('/^[6-9]\d{9}$/', $phone)) $errors['whatsapp'] = 'Please enter a valid 10-digit WhatsApp number.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Please enter a valid email address.';
if (!$consent) $errors['consent'] = 'Consent is required.';

if ($errors) {
    respond(422, ['success' => false, 'message' => 'Validation failed', 'errors' => $errors]);
}

$dir = dirname(CSV_FILE);
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    respond(500, ['success' => false, 'message' => 'Storage unavailable']);
}

$fh = fopen(CSV_FILE, 'c+');
if ($fh === false) {
    respond(500, ['success' => false, 'message' => 'Storage unavailable']);
}

if (!flock($fh, LOCK_EX)) {
    fclose($fh);
    respond(500, ['success' => false, 'message' => 'Storage busy']);
}

fseek($fh, 0, SEEK_END);
if (ftell($fh) === 0) {
    fwrite($fh, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows Hindi names correctly
    fputcsv($fh, CSV_HEADER);
}

$row = [
    date('c'),
    $first,
    $last,
    $class,
    $phone,
    $email,
    'yes',
    $get('session') ?: '2027-28',
    $get('source') ?: 'admissions-landing-page',
    mb_substr($get('page_url'), 0, 300),
    $_SERVER['REMOTE_ADDR'] ?? '',
    mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 300),
];

$ok = fputcsv($fh, array_map('csv_safe', $row)) !== false;
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);

if (!$ok) {
    respond(500, ['success' => false, 'message' => 'Could not save enquiry']);
}

respond(200, ['success' => true]);
