import Head from 'next/head'
import Header from './header'
import Footer from './footer'

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Convert JSON to AVRO schema</title>
        <meta name="description" content="Convert JSON to Avro Schema Online - Easily convert JSON data into Avro Schema format for your data processing needs."/>
        <meta name="keywords" content="JSON to Avro Schema, Avro Schema Converter, JSON Converter, Avro Schema Online"/>
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
