import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "TravelPlanner <system@travel.syapps.net>";

export async function sendVerificationEmail(to: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Confirm your TravelPlanner email",
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;padding:40px;box-shadow:0 2px 16px rgba(26,21,18,0.08);">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;background:#E8622A;border-radius:16px;text-align:center;line-height:56px;font-size:24px;">✈️</div>
          <h1 style="margin:12px 0 4px;font-size:22px;font-weight:700;color:#1A1512;letter-spacing:-0.5px;">TravelPlanner</h1>
          <p style="margin:0;font-size:14px;color:#6B6560;">Plan together, travel better</p>
        </td></tr>
        <tr><td style="border-top:1px solid #F0EDE8;padding-top:24px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1A1512;">Confirm your email address</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#6B6560;line-height:1.5;">
            Click the button below to verify your email and start planning your trips.
            This link expires in 1 hour.
          </p>
          <a href="${url}" style="display:block;text-align:center;background:#E8622A;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;box-shadow:0 2px 8px rgba(232,98,42,0.30);">
            Confirm email address
          </a>
          <p style="margin:20px 0 0;font-size:13px;color:#A09B96;text-align:center;">
            Or copy this link: <a href="${url}" style="color:#E8622A;word-break:break-all;">${url}</a>
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #F0EDE8;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#A09B96;text-align:center;">
            If you did not create an account, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendPasswordResetEmail(to: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your TravelPlanner password",
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;padding:40px;box-shadow:0 2px 16px rgba(26,21,18,0.08);">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;background:#E8622A;border-radius:16px;text-align:center;line-height:56px;font-size:24px;">✈️</div>
          <h1 style="margin:12px 0 4px;font-size:22px;font-weight:700;color:#1A1512;letter-spacing:-0.5px;">TravelPlanner</h1>
          <p style="margin:0;font-size:14px;color:#6B6560;">Plan together, travel better</p>
        </td></tr>
        <tr><td style="border-top:1px solid #F0EDE8;padding-top:24px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1A1512;">Reset your password</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#6B6560;line-height:1.5;">
            We received a request to reset your password. Click the button below to choose a new one.
            This link expires in 1 hour.
          </p>
          <a href="${url}" style="display:block;text-align:center;background:#E8622A;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:12px;box-shadow:0 2px 8px rgba(232,98,42,0.30);">
            Reset password
          </a>
          <p style="margin:20px 0 0;font-size:13px;color:#A09B96;text-align:center;">
            Or copy this link: <a href="${url}" style="color:#E8622A;word-break:break-all;">${url}</a>
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #F0EDE8;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#A09B96;text-align:center;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
