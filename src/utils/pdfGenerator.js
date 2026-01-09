import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export const generateTaxReport = (trades) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(22);
    doc.text('FidelityTracker - Tax Season Summary', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 28);
    doc.line(14, 32, pageWidth - 14, 32);

    // Calculate Summary Data
    const summary = {
        shortTerm: { proceeds: 0, cost: 0, gain: 0, count: 0 },
        longTerm: { proceeds: 0, cost: 0, gain: 0, count: 0 },
        washSales: { count: 0 }
    };

    const washSaleTrades = [];

    // Group trades for detailed tables
    const shortTermTrades = [];
    const longTermTrades = [];

    trades.forEach(trade => {
        if (trade.type === 'SELL') {
            const term = trade.term === 'LONG' ? 'longTerm' : 'shortTerm';

            summary[term].proceeds += (trade.totalProceeds || 0);
            summary[term].cost += (trade.totalCost || 0);
            summary[term].gain += (trade.realizedPL || 0);
            summary[term].count++;

            if (term === 'longTerm') longTermTrades.push(trade);
            else shortTermTrades.push(trade);

            if (trade.isWashSale) {
                summary.washSales.count++;
                washSaleTrades.push(trade);
            }
        }
    });

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Summary Table
    doc.setFontSize(14);
    doc.text('Summary', 14, 45);

    doc.autoTable({
        startY: 50,
        head: [['Term', 'Count', 'Proceeds', 'Cost Basis', 'Realized Gain/Loss']],
        body: [
            [
                'Short-Term (< 1 Year)',
                summary.shortTerm.count,
                formatCurrency(summary.shortTerm.proceeds),
                formatCurrency(summary.shortTerm.cost),
                formatCurrency(summary.shortTerm.gain)
            ],
            [
                'Long-Term (> 1 Year)',
                summary.longTerm.count,
                formatCurrency(summary.longTerm.proceeds),
                formatCurrency(summary.longTerm.cost),
                formatCurrency(summary.longTerm.gain)
            ],
            [
                { content: 'Total', styles: { fontStyle: 'bold' } },
                summary.shortTerm.count + summary.longTerm.count,
                formatCurrency(summary.shortTerm.proceeds + summary.longTerm.proceeds),
                formatCurrency(summary.shortTerm.cost + summary.longTerm.cost),
                {
                    content: formatCurrency(summary.shortTerm.gain + summary.longTerm.gain),
                    styles: {
                        fontStyle: 'bold',
                        textColor: (summary.shortTerm.gain + summary.longTerm.gain) >= 0 ? [0, 128, 0] : [200, 0, 0]
                    }
                }
            ]
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] }
    });

    let currentY = doc.lastAutoTable.finalY + 15;

    // Wash Sales Warning
    if (summary.washSales.count > 0) {
        doc.setFontSize(14);
        doc.setTextColor(200, 0, 0);
        doc.text(`Potential Wash Sales Detected (${summary.washSales.count})`, 14, currentY);
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text('The following trades look like wash sales (loss + repurchase within 30 days).', 14, currentY + 6);

        doc.autoTable({
            startY: currentY + 10,
            head: [['Date', 'Symbol', 'Loss Amount', 'Detected Trigger']],
            body: washSaleTrades.map(t => [
                format(new Date(t.date), 'MM/dd/yyyy'),
                t.symbol,
                formatCurrency(t.realizedPL),
                t.washSaleMsg || '-'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [200, 50, 50] }
        });

        currentY = doc.lastAutoTable.finalY + 15;
    }

    doc.setTextColor(0, 0, 0); // Reset color

    // Detailed Ledger - Short Term
    if (shortTermTrades.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Detailed Ledger: Short-Term Trades', 14, 20);

        doc.autoTable({
            startY: 25,
            head: [['Date', 'Symbol', 'Qty', 'Price', 'Proceeds', 'Cost', 'Gain/Loss']],
            body: shortTermTrades
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(t => [
                    format(new Date(t.date), 'MM/dd/yyyy'),
                    t.symbol,
                    t.quantity,
                    formatCurrency(t.price),
                    formatCurrency(t.totalProceeds),
                    formatCurrency(t.totalCost),
                    formatCurrency(t.realizedPL)
                ]),
            theme: 'plain',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 100, 100], textColor: 255 }
        });
    }

    // Detailed Ledger - Long Term
    if (longTermTrades.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Detailed Ledger: Long-Term Trades', 14, 20);

        doc.autoTable({
            startY: 25,
            head: [['Date', 'Symbol', 'Qty', 'Price', 'Proceeds', 'Cost', 'Gain/Loss']],
            body: longTermTrades
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(t => [
                    format(new Date(t.date), 'MM/dd/yyyy'),
                    t.symbol,
                    t.quantity,
                    formatCurrency(t.price),
                    formatCurrency(t.totalProceeds),
                    formatCurrency(t.totalCost),
                    formatCurrency(t.realizedPL)
                ]),
            theme: 'plain',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [16, 185, 129], textColor: 255 } // Green header
        });
    }

    // Save
    doc.save(`FidelityTracker_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
