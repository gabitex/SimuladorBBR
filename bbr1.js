class SimuladorBBR{
    constructor(total){ this.reiniciar(total); }
    reiniciar(total){
        this.historial = { ev: [], bdp: [], bw: [] };
        this.paso = 0; this.evActual = 0; this.tx = 0; this.rx = 0;
        this.total = parseInt(total) || 1000;
        this.utilizacionSuma = 0;
    }
    simular(esc, bwI, rtt){
        if (this.tx >= this.total && this.evActual <= 0) return null;

        this.paso++;
        var bw = (esc === "1") ? bwI : 
                 (esc === "2") ? (this.tx < this.total / 2 ? bwI : bwI * 2.5) :
                 bwI + Math.sin(this.paso * 0.4) * (bwI * 0.5);

        var bdpPuro = (bw * 1e6 * (rtt / 1000)) / 12000; 
        var ganancia = this.paso < 20 ? 2.89 : [1.25, 0.75, 1, 1, 1][this.paso % 5] || 1;
        var bdpGanancia = bdpPuro * ganancia;

        var enviar = Math.max(0, Math.floor(bdpGanancia - this.evActual));
        if (enviar === 0 && bw > 0) enviar = 1;
        enviar = Math.min(enviar, this.total - this.tx);

        var capacidad = Math.max(1, Math.floor(bw * 1.05)); 
        var recibir = Math.min(this.evActual + enviar, capacidad);

        var util = Math.min(100, (recibir / capacidad) * 100);
        this.utilizacionSuma += util;

        this.evActual += enviar - recibir;
        this.tx += enviar;
        this.rx += recibir;

        this.historial.ev.push(this.evActual);
        this.historial.bdp.push(bdpGanancia);
        this.historial.bw.push(bdpPuro);

        return { ev: this.evActual, tx: this.tx, rx: this.rx, bdp: bdpGanancia, util: util };
    }
}
const bbr = new SimuladorBBR();
var loop = null;
const lienzo = document.getElementById("grafico");
const ctx = lienzo.getContext("2d");

function dibujar(final = false){
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    const maxVal = Math.max(...bbr.historial.ev, ...bbr.historial.bdp, 10);
    const escY = (lienzo.height * 0.8) / maxVal;
    const escX = lienzo.width / (final ? bbr.historial.ev.length : Math.max(bbr.paso, 20));

    const linea = (datos, color, ancho, dash = []) =>{
        if (datos.length < 2) return;
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = ancho;
        ctx.lineJoin = "round";
        datos.forEach((v, i) => ctx.lineTo(i * escX, lienzo.height - v * escY));
        ctx.stroke();
    };
    linea(bbr.historial.bw, "#2ecc71", 2, [5, 5]); 
    linea(bbr.historial.bdp, "#3498db", 2);        
    linea(bbr.historial.ev, "#e74c3c", 3);         
}

document.getElementById("simularBtn").onclick = () =>{
    if (loop) clearInterval(loop);
    bbr.reiniciar(document.getElementById("total_paquetes").value);
    const [esc, bw, rtt] = ["escenario", "bw_inicial", "rtt_base"].map(id => document.getElementById(id).value);

    loop = setInterval(() =>{
        var res = bbr.simular(esc, parseFloat(bw), parseFloat(rtt));
        if (!res){
            clearInterval(loop);
            dibujar(true);
            var promedio = Math.floor(bbr.utilizacionSuma / bbr.paso);
            document.getElementById("txt-estado").innerHTML = 
                `ESTADO: <span style="color:#004a99">FINALIZADO | Utilización Media: ${promedio}%</span>`;
            return;
        }
        dibujar();
        document.getElementById("txt-emisor").innerHTML = 
            `EMISOR: <span style="color:#a00">${res.ev}</span> en vuelo | TX: ${res.tx}`;
        
        document.getElementById("txt-receptor").innerHTML = 
            `RECEPTOR: Total RX: <span style="color:#060">${res.rx}</span>`;
        
        document.getElementById("txt-estado").innerHTML = 
            `ESTADO: <span style="color:#004a99">BDP OBJETIVO: ${Math.floor(res.bdp)} pqts | Eficiencia: ${Math.floor(res.util)}%</span>`;
    }, 150);
};

document.getElementById("resetBtn").onclick = () => location.reload();
