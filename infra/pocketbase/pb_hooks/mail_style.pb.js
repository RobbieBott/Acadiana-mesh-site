/// <reference path="../pb_data/types.d.ts" />
onMailerSend((e) => require(__hooks + "/mail_style.js").send(e));
onMailerRecordPasswordResetSend((e) => require(__hooks + "/mail_style.js").classify(e, "Password setup or reset"));
onMailerRecordVerificationSend((e) => require(__hooks + "/mail_style.js").classify(e, "Email verification"));
onMailerRecordEmailChangeSend((e) => require(__hooks + "/mail_style.js").classify(e, "Sign-in email confirmation"));
onMailerRecordOTPSend((e) => require(__hooks + "/mail_style.js").classify(e, "Sign-in code"));
onMailerRecordAuthAlertSend((e) => require(__hooks + "/mail_style.js").classify(e, "New sign-in alert"));
