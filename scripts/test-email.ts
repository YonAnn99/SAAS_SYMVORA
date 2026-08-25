import { sendWelcomeEmail } from "../src/lib/email";

async function main() {
  const to = process.env.TEST_EMAIL_TO;
  if (!to) throw new Error("TEST_EMAIL_TO required");

  console.log("Enviando variante signup...");
  const r1 = await sendWelcomeEmail({
    to,
    businessName: "Tienda Prueba",
    referralCode: "SYMTEST01",
    type: "signup",
  });
  console.log("signup:", r1);

  console.log("Enviando variante first_payment...");
  const r2 = await sendWelcomeEmail({
    to,
    businessName: "Tienda Prueba",
    referralCode: "SYMTEST01",
    type: "first_payment",
  });
  console.log("first_payment:", r2);
}

main();
