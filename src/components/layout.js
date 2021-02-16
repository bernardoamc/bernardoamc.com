import React from "react"
import Header from "./header"

const Layout = ({ location, title, menu, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <Header menu={menu} />
      <main>{children}</main>
      <footer>
        © Bernardo de Araujo {new Date().getFullYear()}
      </footer>
    </div>
  )
}

export default Layout
