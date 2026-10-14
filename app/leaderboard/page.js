'use client'
import {Leaderboard} from '../../components/Boards'
export default function P(){return <div className="pg-wrap"><div className="pg-head"><span className="bd-chip">🏆 Papan peringkat</span><h1>Leaderboard global</h1><p>Semua pengguna dalam satu papan: saldo, jumlah transaksi, berapa kali deposit, transaksi sukses, dan gagal. Email disensor demi privasi.</p></div><Leaderboard limit={50}/></div>}
