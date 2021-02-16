import React from "react"

const Header = ({ menu }) => (
  <header>
    <nav className="menu">
      <ul>
        {menu.map(link => (
          <li key={link.name} className="menu-item">
            <a href={link.link}>{link.name}</a>
          </li>
        ))}
      </ul>
    </nav>
  </header>
)

export default Header
