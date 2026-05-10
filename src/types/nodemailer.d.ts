declare module 'nodemailer' {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
  }

  interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
  }

  export function createTransport(options: TransportOptions): Transporter;
}
