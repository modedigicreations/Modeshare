import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Modeshare — Internal Marketing Platform',
  description: 'AI-powered social media publishing for your team',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID || '948046124459514'
  const fbApiVersion = process.env.NEXT_PUBLIC_FACEBOOK_API_VERSION || 'v19.0'

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="h-full">
        {children}
        {fbAppId && (
          <Script id="facebook-jssdk-init" strategy="afterInteractive">
            {`
              window.fbAsyncInit = function() {
                FB.init({
                  appId      : '${fbAppId}',
                  cookie     : true,
                  xfbml      : true,
                  version    : '${fbApiVersion}'
                });
                  
                FB.AppEvents.logPageView();   
              };

              (function(d, s, id){
                 var js, fjs = d.getElementsByTagName(s)[0];
                 if (d.getElementById(id)) {return;}
                 js = d.createElement(s); js.id = id;
                 js.src = "https://connect.facebook.net/en_US/sdk.js";
                 fjs.parentNode.insertBefore(js, fjs);
               }(document, 'script', 'facebook-jssdk'));
            `}
          </Script>
        )}
      </body>
    </html>
  )
}
