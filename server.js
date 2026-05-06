const express = require('express');
require('dns').setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({ connectionString: process.env.DB_STRING });

async function runQuery(sql, binds = []) {
  try {
    const result = await pool.query(sql, binds);
    return { success: true, rows: result.rows };
  } catch (err) {
    return { success: false, error: err.message, rows: [] };
  }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'site-a.html')));

app.get('/api/tourists',        async (req, res) => res.json(await runQuery('SELECT * FROM tourists ORDER BY touristid')));
app.get('/api/tourist-basic',   async (req, res) => res.json(await runQuery('SELECT * FROM tourist_basic ORDER BY touristid')));
app.get('/api/tourist-contact', async (req, res) => res.json(await runQuery('SELECT * FROM tourist_contact ORDER BY touristid')));
app.get('/api/trips',           async (req, res) => res.json(await runQuery('SELECT * FROM trips ORDER BY tripid')));
app.get('/api/trips-north',     async (req, res) => res.json(await runQuery('SELECT * FROM trips_north ORDER BY tripid')));
app.get('/api/bookings',        async (req, res) => res.json(await runQuery('SELECT * FROM bookings ORDER BY bookingid')));
app.get('/api/booking-info',    async (req, res) => res.json(await runQuery('SELECT * FROM booking_info ORDER BY bookingid')));
app.get('/api/booking-amount',  async (req, res) => res.json(await runQuery('SELECT * FROM booking_amount ORDER BY bookingid')));
app.get('/api/guides',          async (req, res) => res.json(await runQuery('SELECT * FROM guides ORDER BY guideid')));
app.get('/api/events',          async (req, res) => res.json(await runQuery('SELECT * FROM culturalevents ORDER BY eventid')));
app.get('/api/tables',          async (req, res) => res.json(await runQuery(`SELECT table_name AS TABLE_NAME FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`)));

app.get('/api/global/all-trips', async (req, res) => {
  try {
    const [northResult, southRes] = await Promise.all([
      runQuery('SELECT * FROM trips'),
      fetch(process.env.SITE_B_URL + '/api/trips').then(r => r.json())
    ]);
    const allTrips = [
      ...northResult.rows.map(t => ({ ...t, source: 'North' })),
      ...(southRes.rows || []).map(t => ({ ...t, source: 'South' })),
    ];
    res.json({ success: true, rows: allTrips });
  } catch (err) {
    res.json({ success: false, error: err.message, rows: [] });
  }
});

app.get('/api/global/itinerary', async (req, res) => {
  res.json(await runQuery(`
    SELECT b.bookingid, t.name AS touristname, b.amount, tr.region, tr.startdate, tr.enddate
    FROM bookings b
    JOIN tourist_basic t ON b.touristid = t.touristid
    JOIN trips tr ON b.tripid = tr.tripid
    ORDER BY b.bookingid
  `));
});

app.get('/api/global/itinerary/:touristId', async (req, res) => {
  res.json(await runQuery(`
    SELECT t.name AS touristname, b.bookingid, b.amount, tr.region, tr.startdate, tr.enddate
    FROM tourist_basic t
    JOIN booking_info b ON t.touristid = b.touristid
    JOIN trips tr ON b.tripid = tr.tripid
    WHERE t.touristid = $1
  `, [parseInt(req.params.touristId)]));
});

// FIX: stats now count trips_north for the "TRIPS (NORTH)" stat
app.get('/api/stats', async (req, res) => {
  const [tourists, trips, bookings] = await Promise.all([
    runQuery('SELECT COUNT(*) AS cnt FROM tourists'),
    runQuery('SELECT COUNT(*) AS cnt FROM trips_north'),
    runQuery('SELECT COUNT(*) AS cnt FROM bookings'),
  ]);
  res.json({
    tourists: tourists.rows[0]?.cnt || 0,
    trips:    trips.rows[0]?.cnt    || 0,
    bookings: bookings.rows[0]?.cnt || 0,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Site A (North) running on port ${PORT}`));
