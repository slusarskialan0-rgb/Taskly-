# TASKLY PRO

A lightweight, browser-based SaaS panel for managing physical work orders (zlecenia pracy fizycznej). Built with pure HTML, CSS, and vanilla JavaScript – no build tools or frameworks required.

## Features

- **Dashboard** – at-a-glance stats: total orders, completed, in-progress, daily profit, monthly profit, and total worker count. Shows the most recent orders.
- **Work Orders (Zlecenia)** – create, edit, and delete orders. Filter by status, sort by date or profit, and search by city. Profit is calculated automatically using the formula: `(client rate − worker rate) × hours × number of people`.
- **Workers (Pracownicy)** – manage your workforce: name, phone, skills, and availability toggle.
- **Clients (Klienci)** – keep a client directory with company name, phone, e-mail, and notes.
- **Statistics (Statystyki)** – visual breakdowns of monthly profit, order status distribution, and top 5 cities.
- **Responsive UI** – collapsible sidebar for mobile; works on any screen size.
- **Offline-first** – all data is stored in `localStorage` by default. Optionally connect a Google Apps Script backend by setting `API_BASE` in `api.js`.

## Getting Started

No installation needed. Just open the files in a browser.

1. Clone or download the repository.
2. Open `index.html` in any modern browser.
3. Log in with the default credentials:
   - **Login:** `admin`
   - **Password:** `admin123`

> **Note:** The login is a simple client-side check. For production use, replace it with a real authentication mechanism.

## File Structure

```
├── index.html   # Login page
├── app.html     # Main application shell (sidebar, sections, modals)
├── app.js       # Application logic (rendering, events, profit calculation)
├── api.js       # Data layer – localStorage; Jobs can optionally sync via Google Apps Script
└── style.css    # All styles (login, sidebar, cards, modals, responsive)
```

## Connecting a Backend (optional)

The app ships with a `localStorage` backend. To persist data server-side via Google Apps Script:

1. Deploy your Apps Script project as a web app and copy its URL.
2. Open `api.js` and set `API_BASE` to that URL:
   ```js
   const API_BASE = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
3. Implement the expected actions (`getJobs`, `saveJob`, `deleteJob`, etc.) in your Apps Script, following the calling convention used by `api.js`:

   - **Get jobs:** `GET ${API_BASE}?action=getJobs`  
     The backend should respond with JSON, either as an array of job objects:
     ```json
     [
       { "id": "1", "client": "ACME", "...": "..." }
     ]
     ```
     or wrapped in an object:
     ```json
     { "jobs": [ { "id": "1", "client": "ACME", "...": "..." } ] }
     ```

   - **Save job:** `POST ${API_BASE}` with a JSON body:
     ```json
     {
       "action": "saveJob",
       "job": { "id": "1", "client": "ACME", "...": "..." }
     }
     ```
     Respond with JSON, for example:
     ```json
     { "success": true, "job": { "id": "1", "client": "ACME", "...": "..." } }
     ```

   - **Delete job:** `POST ${API_BASE}` with a JSON body:
     ```json
     {
       "action": "deleteJob",
       "id": "1"
     }
     ```
     Respond with JSON, for example:
     ```json
     { "success": true }
     ```

   All responses must be valid JSON, and your web app deployment must allow CORS requests from the origin where you host Taskly Pro.
The API layer falls back to `localStorage` automatically whenever the remote endpoint is unavailable.

## Profit Calculation

```
profit = (clientRate − workerRate) × hours × people
```

- **clientRate** – hourly rate charged to the client (PLN/h)
- **workerRate** – hourly rate paid to the worker (PLN/h)
- **hours** – duration of the job
- **people** – number of workers assigned

A live profit preview is shown while filling in or editing an order.

## License

MIT
