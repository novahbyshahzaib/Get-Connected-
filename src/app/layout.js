import './globals.css';

export const metadata = {
  title: 'Get Connected - Secure File Sharing',
  description: 'Share files securely with PIN-protected links',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Inter']">{children}</body>
    </html>
  );
}
