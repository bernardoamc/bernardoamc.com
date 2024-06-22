import React from "react"
import { graphql } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import Seo from "../components/seo"

const HomeIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title
  const menuLinks = data.site.siteMetadata?.menuLinks

  return (
    <Layout location={location} title={siteTitle} menu={menuLinks}>
      <Seo title="Home" />
      <Bio />
      <h1 className="main-header">About Me</h1>
      <p>
        My name is <strong>Bernardo</strong>. I'm from Rio de Janeiro, Brazil
        but have been living in Montreal, Canada since 2016.
      </p>
      <p>
        I'm an Application Security Engineer @Stripe, previously an Application Security Manager @Shopify
        and an Engineering Manager at <a href="https://shop.app/what-shop-does">Shop</a>.
      </p>
      <p>
        Outside of work you can likely find me in a Bouldering or Jiu Jitsu gym.
        I've also been programming in Rust and tackling security challenges (CTFs)
        lately.
      </p>
      <p>
        I'm always open to have a good conversation, irrespective of topic.
        If you have a favourite subject and want to brainstorm or just share
        please hit me up.{" "}
      </p>
      <p>
        You can reach out to me on Twitter as{" "}
        <a href="https://twitter.com/bernardo_amc">@bernardo_amc</a>.
      </p>
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
