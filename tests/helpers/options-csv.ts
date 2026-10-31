// Synthetic activity exports only; never copy real brokerage records here.
export const optionsCsvHeader =
  "effective_date,effective_time,account_id,activity_type,activity_sub_type,symbol,currency,quantity,unit_price,commission,net_cash_amount,direction";
export const optionsCsv = [
  optionsCsvHeader,
  "2026-09-01,10:00:00,PRIVATE_SYNTHETIC_UPLOAD,Trade,SELL,SYNTH261218C00100000,USD,-1,1,2,98,SHORT",
  "2026-09-02,10:00:00,PRIVATE_SYNTHETIC_UPLOAD,Trade,BUY,SYNTH261218C00100000,USD,1,0.4,1,-41,SHORT",
].join("\n");
