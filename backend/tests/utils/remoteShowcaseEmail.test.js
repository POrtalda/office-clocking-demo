jest.mock("nodemailer",()=>({createTransport:jest.fn()}));
const mailer=require("nodemailer");const {sendEmail}=require("../../utils/email");
test("Showcase cannot send to any recipient even if SMTP variables accidentally exist",async()=>{
 const old=process.env.APP_ENV;process.env.APP_ENV="showcase";
 try {expect(await sendEmail({to:["real-recipient@company.com"],subject:"fixture",text:"fixture"})).toEqual({skipped:true,reason:"SHOWCASE_EMAIL_DISABLED"});expect(mailer.createTransport).not.toHaveBeenCalled();}
 finally {if(old===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=old;}
});
