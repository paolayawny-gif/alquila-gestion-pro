// Ambient declarations for packages present in package.json but not resolvable
// in the worktree module-resolution context.

/* eslint-disable @typescript-eslint/no-explicit-any */

// jspdf — used via dynamic import({ jsPDF })
declare module 'jspdf' {
  export const jsPDF: any;
}

// jspdf-autotable — used via dynamic import().default
declare module 'jspdf-autotable' {
  const autoTable: any;
  export default autoTable;
}

// ethers v6 — used as: import { ethers } from 'ethers'
declare module 'ethers' {
  export const ethers: any;
}

// node-forge — used as: import forge from 'node-forge'
declare module 'node-forge' {
  const forge: any;
  export default forge;
  export const pki: any;
  export const pkcs12: any;
  export const asn1: any;
  export const util: any;
  export const random: any;
  export const pkcs7: any;
}
