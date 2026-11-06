import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { isPlainLeftClick, navigate } from './router'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

// A real <a href>: keyboard, screen readers and "open in a new tab" work as on any link.
// A plain left click changes the screen without reloading the page.
export function Link({ href, onClick, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (!isPlainLeftClick(event, event.currentTarget.getAttribute('target'))) return
    event.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handleClick} {...rest} />
}
