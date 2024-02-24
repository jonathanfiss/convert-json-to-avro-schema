import Head from 'next/head'
import Header from './header'
import Footer from './footer'

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Convert JSON to AVRO schema</title>
        <meta name="description" content="Convert json to AVRO schema"></meta>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="google-site-verification" content="21m4xhh-BeM57W92dFu_VNTuu5recjRHtgZXQDGFdg0" />
      </Head>
      <div className='min-vh-100'>
      <Header />
      <main className='d-flex flex-column'>{children}</main>
      <Footer />
      </div>
    </>
  )
}
