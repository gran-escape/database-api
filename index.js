import Express, { urlencoded } from "express";
import BodyParser from "body-parser";
import pg from "pg";

const app = new Express();
const port = 4000;
const db = new pg.Client({
  database: "invoices",
  port: 5432,
  user: "postgres",
  password: "bH-1994",
  host: "localhost",
});

db.connect();

app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());

/**
 * Get all invoices in database and return them. Will have to limit this later and
 * possibly just general details for a dashboard at some point.
 */
app.get("/GetAllInvoiceGeneral", async (req, res) => {
  // grabbing general info for all invoices in database... for now.
  try {
    console.log("returning general invoice information for all");
    const response = await db.query(
      "SELECT * FROM invoice ORDER BY date_created DESC"
    );
    console.log(response.rows);
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

/**
 * Get a single invoice information by id (invoice number)
 */
app.get("/GetInvoiceGeneral", async (req, res) => {
  const invoiceId = parseInt(req.query.id);
  console.log("returning general invoice information for invoice " + invoiceId);

  try {
    const response = await db.query("SELECT * FROM invoice WHERE id = $1", [
      invoiceId,
    ]);
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

/**
 * Get all invoice details without general information. No constraints on
 * dates or invoice numbers.
 */
app.get("/GetAllDetails", async (req, res) => {
  console.log("returning all invoice details");
  try {
    const response = await db.query("SELECT * FROM invoice_item");
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

/**
 * Gets all details for the given invoice. Returns to sender.
 */
app.get("/GetDetails", async (req, res) => {
  const invoiceId = parseInt(req.query.id);
  console.log("getting details for invoice " + invoiceId);

  try {
    const response = await db.query(
      "SELECT * FROM invoice_item WHERE invoice_id = $1",
      [invoiceId]
    );
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

/**
 * returns
 */
app.get("/GetInvoicesFromDate", async (req, res) => {
  const today = new Date().toLocaleDateString().replaceAll("/", "-");

  try {
    const response = await db.query(
      "SELECT * FROM invoice WHERE date_created = $1",
      [today]
    );
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

/**
 * adds a single invoice and all the detail line items. Might need to make this more
 * generic in the future.
 */
app.post("/AddInvoice", async (req, res) => {
  const { location, invoiceNotes, date, total } = req.body.invoice.invoiceInfo;
  const { rows } = req.body.details;
  let invoiceId = null;

  console.log(
    `***** API call ****\nlocation: ${location}  notes: ${invoiceNotes}  date: ${date}  total:${total}`
  );

  try {
    const invRes = await db.query(
      "INSERT INTO invoice(price, location, date_created, invoice_notes) VALUES(ROUND($1,2), $2, $3, $4) RETURNING id",
      [total, location, date, invoiceNotes]
    );

    const { id } = invRes.rows[0];
    invoiceId = id;
    console.log(`New invoice ID: ${invoiceId}`);
  } catch (error) {
    console.log(`[error] problem sending invoice to database\n` + error);
    res.sendStatus(500);
  }

  rows.forEach(async (row, index) => {
    const { name, cost, quantity, notes } = row;

    try {
      console.log(invoiceId);
      const detailRes = await db.query(
        "INSERT INTO invoice_item(invoice_id, item_name, item_price, item_qty, item_notes) " +
          "VALUES($1, $2, $3, $4, $5)",
        [invoiceId, name, cost, quantity, notes]
      );
    } catch (error) {
      console.log(`[error] problem sending detail ${index}\n` + error);
      res.sendStatus(500);
    }
  });

  res.sendStatus(200);
});

/**
 * API call to delete a given invoice (passed as query) from
 * the database. Removes from invoice table and then the
 * invoice_item table for each detail line.
 */
app.delete("/DeleteInvoice", async (req, res) => {
  const id = req.query.id;
  try {
    console.log("[db api] delete called");
    // TODO: return something to return errors to web api, might be cached data
    const delDetRes = await db.query(
      "DELETE FROM invoice_item WHERE invoice_id = $1",
      [id]
    );
    const delInvRes = await db.query("DELETE FROM invoice WHERE id=$1", [id]);

    res.sendStatus(200); // if good, return good result
  } catch (error) {
    console.error("[error] error during write/ read to database " + error);
    res.sendStatus(500);
  }
});

app.patch("/Update", async (req, res) => {
  console.log("Update Called!");
});

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`);
});
