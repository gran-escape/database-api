import Express, { urlencoded } from "express";
import BodyParser from "body-parser";
import pg from "pg";

const dbPass = process.env.DB_LOGIN;
const app = new Express();
const port = 4000;
const db = new pg.Client({
  database: "invoices",
  port: 5432,
  user: "postgres",
  password: dbPass,
  host: "localhost",
});

db.connect();

app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());

/**
 * takes the detail data sent over from the
 * server and deconstructs it into a JSON
 * object for use in a React state.
 *
 * @param {JSON} detailData
 * @returns JSON data
 */
function deconstructDetailData(detailData) {
  let detailArr = [];
  detailData.forEach((detail) => {
    // deconstruct for better variable names
    const {
      id: id,
      item_name: name,
      item_notes: notes,
      item_price: cost,
      item_qty: quantity,
    } = detail;
    detailArr.push({
      id,
      name,
      notes,
      cost,
      quantity,
      total: (quantity * cost).toFixed(2),
    });
  });
  return detailArr;
}

function deconstructGeneralData(invoiceData) {
  // deconstruct the general invoice info
  const {
    id,
    price,
    location,
    date_created: date,
    invoice_notes: invoiceNotes,
  } = invoiceData;

  return {
    id: id,
    price: price,
    location: location,
    date: new Date(date).toISOString().substring(0, 10),
    invoiceNotes: invoiceNotes,
  };
}
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
    //console.log(response.rows);
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
 * returns all invoices from **today**
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
 * given two dates, will return all invoices that are within the date range
 */
app.get("/InvoicesDateRange", async (req, res) => {
  try {
    const { begin, end } = req.query;
    const response = await db.query(
      "select * from invoice where date_created >= $1 and date_created <= $2",
      [begin, end]
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
    console.log(row);
    const { name, cost, quantity, notes, taxVal, taxed } = row;

    try {
      console.log(invoiceId);
      const detailRes = await db.query(
        "INSERT INTO invoice_item(invoice_id, item_name, item_price, item_qty, item_notes) " +
          "VALUES($1, $2, $3, $4, $5)",
        [invoiceId, name, cost, quantity, notes]
      );
    } catch (error) {
      console.log(`[error] problem sending detail ${index}\n` + error);
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

app.put("/Update", async (req, res) => {
  console.log(req.body.details); // debugging
  const detailList = req.body.details;
  const { id, price, location, date, invoiceNotes } = req.body.general;

  // try to update the general info
  try {
    await db.query(
      `UPDATE invoice SET price=$1, location=$2, date_created=$3, invoice_notes=$4 WHERE id=$5`,
      [price, location, date, invoiceNotes, id]
    );

    // delete old line details
    await db.query(`DELETE FROM invoice_item WHERE invoice_id=$1`, [id]);

    // re-add all line items
    detailList.forEach(async (line) => {
      console.log(line);
      await db.query(
        "INSERT INTO invoice_item(invoice_id, item_name, item_price, item_qty, item_notes) " +
          "VALUES($1, $2, $3, $4, $5)",
        [id, line.name, line.cost, line.quantity, line.notes]
      );
    });

    res.sendStatus(200);
  } catch (error) {
    console.log("[error] error during update" + error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`[api] listening on port ${port}`);
});
