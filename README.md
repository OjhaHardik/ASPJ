# Allenhouse Jhansi Admissions 2027-28 landing page

Plain HTML, CSS and JavaScript. No build step, no framework. Same structure, sections
and enquiry form as the Lucknow page (`S:\APSL`); top bar, navbar, footer, links and
contact details are taken from https://allenhousejhansi.com/.

```
index.html            the page
css/styles.css        all styles (mobile-first, responsive)
js/main.js            mobile menu, enquiry form, footer newsletter
submit.php            saves each enquiry as a row in data/enquiries.csv
data/enquiries.csv    the enquiry records (created on first submission)
data/.htaccess        blocks public download of the CSV (Apache / LiteSpeed)
web.config            blocks public download of the CSV (IIS)
.htaccess             index.html as default page, no folder listings
assets/img/           Jhansi logos and hero photo (from allenhousejhansi.com)
dev-server.js         local testing only (Node); do not upload
```

## Hosting

1. Upload everything except `dev-server.js` to a host with PHP 7.2 or newer.
   allenhousejhansi.com runs IIS with PHP: `web.config` protects `data/` there;
   on Apache / LiteSpeed the `.htaccess` files do it.
2. Make sure `data/` is writable by the web server.
3. Download the records any time from the hosting file manager: `data/enquiries.csv`.
   The CSV cannot be opened from the browser; that is intentional.
4. Check after upload: `https://<site>/admissions/data/enquiries.csv` must return 403 or 404.

The page assumes it lives at `https://allenhousejhansi.com/admissions` (canonical
and social-share tags). Change those `<head>` URLs if it goes elsewhere.

The footer newsletter posts to `https://allenhousejhansi.com/proxy/newsletter-proxy.php`,
the same endpoint the main site uses. That endpoint does not allow other domains, so
it only works when this page is served from allenhousejhansi.com.

## Local testing

The form needs PHP, so VS Code Live Server and opening the file directly will
always show "Sorry, we couldn't send your enquiry". Use one of these instead:

- **XAMPP:** link or copy this folder to `C:\xampp\htdocs\APSJ`, start Apache and open
  http://localhost/APSJ/
- **Node:** run `node dev-server.js` and open http://localhost:5502

Submissions are written to `data/enquiries.csv`.

## Still to do before going live

- allenhousejhansi.com has no Privacy Policy page, so the consent text links only to
  Terms and Conditions. Add a privacy link once that page exists.
