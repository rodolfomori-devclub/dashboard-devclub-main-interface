/* eslint-disable react/prop-types -- Internal React 19 components with explicit props. */
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
export default function Dialog({ title, children, onClose, wide = false }) {
 const ref=useRef(null), id=useId()
 useEffect(()=>{const dialog=ref.current,opener=document.activeElement;dialog.showModal();return()=>{dialog.close();opener?.focus?.()}},[])
 return <dialog ref={ref} className={`workspace-dialog ${wide?'workspace-dialog-wide':''}`} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="dialog-inner"><header><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20}/></button></header>{children}</div></dialog>
}
