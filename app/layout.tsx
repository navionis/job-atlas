import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Job Atlas — Work without borders",description:"Country-aware job discovery across public and configured job feeds.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
