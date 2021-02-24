import React from "react"
import { graphql } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import SEO from "../components/seo"

const HomeIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title
  const menuLinks = data.site.siteMetadata?.menuLinks

  return (
    <Layout location={location} title={siteTitle} menu={menuLinks}>
      <SEO title="Home" />
      <Bio />
      <h1 className="main-header">About Me</h1>

      <p>My name is <strong>Bernardo</strong>. I'm from Rio de Janeiro, Brazil but have been living in Canada since 2016.</p>
      <p>I'm an engineering manager @Shopify, currently working on <a href="https://shop.app/what-shop-does">Shop Pay</a>.</p>
      <p>
       I value my free time and dedicate a lot of it to sports like Bouldering, Jiu Jitsu, and Parkour.
      </p>
      <p>These days I've been playing with Rust programming and security challenges (CTFs).</p>
      <p>I'm always open to talk about gaming, good books and TV series, especially ones that involve Fantasy, Sci-fi or technology in general. </p>
      <p>You can reach out to me on Twitter as <a href="https://twitter.com/bernardo_amc">@bernardo_amc</a>.</p>
    </Layout>
  )
}

export default HomeIndex

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
        menuLinks {
          name
          link
        }
      }
    }
  }
`
