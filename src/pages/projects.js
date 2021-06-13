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
      <Seo title="Projects" />
      <Bio />
      <h3>Personal Projects</h3>
      <p>
        On my spare time I like to build small tools that solve a specific
        problem that I'm currently facing.
      </p>
      <p>My recent ones are:</p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/bernardoamc/itp_tldr"
        >
          ITP TL;DR;
        </a>
      </h4>
      <p>
        The tool everyone needs to reason about Safari's ITP by providing
        real-time statistics as you navigate through different domains.
      </p>
      <p>
        Safari's ITP Debug Mode lacks information, this tool is an attempt to
        make your life as a developer a bit easier.
      </p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/RustScan/RustScan/"
        >
          RustScan
        </a>
      </h4>
      <p>
        A modern port scanner written in Rust with an integrated scripting
        engine.
      </p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/bernardoamc/ruby_debugging"
        >
          Ruby Debugging
        </a>
      </h4>
      <p>
        The goal of this repository is to get you familiar with common debugging
        tools and idioms from Ruby. At the end of it I hope you will have a
        better understanding of Ruby itself.
      </p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/bernardoamc/minitag"
        >
          Minitag
        </a>
      </h4>
      <p>
        A framework agnostic Ruby gem that allow developers using minitest to
        specify tags for their classNamees and tests, and run their test suite
        based on these tags.
      </p>
      <p>
        Inspired by Elixir's ExUnit{" "}
        <a href="https://hexdocs.pm/ex_unit/ExUnit.Case.html#module-tags">
          tags
        </a>
        .
      </p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/bernardoamc/slack-emoji-grid"
        >
          Slack Emoji Grid
        </a>
      </h4>
      <p>
        Allows you to create a grid of emojis from a single image and
        automatically uploads them to Slack.
      </p>
      <h4>
        <a
          className="project-title"
          href="https://github.com/bernardoamc/text-placeholder"
        >
          Text Placeholder
        </a>
      </h4>
      <p>A minimal text template engine written in Rust.</p>
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
