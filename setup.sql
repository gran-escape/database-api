/* prep for update, need to add full database setup later */

alter table invoice_item
add taxed boolean not null default false;

alter table invoice_item
add tax_val numeric not null default 0;