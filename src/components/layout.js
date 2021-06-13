import React from "react"
import Header from "./header"

import { defineCustomElements as deckDeckGoHighlightElement } from "@deckdeckgo/highlight-code/dist/loader"
deckDeckGoHighlightElement()

const Layout = ({ location, title, menu, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <Header menu={menu} />
      <main>{children}</main>
      <footer>© Bernardo de Araujo {new Date().getFullYear()}</footer>
    </div>
  )
}

export default Layout
