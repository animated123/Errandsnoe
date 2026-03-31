import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Errand } from '../types';

export const pdfService = {
  downloadShoppingPDF: (errand: any) => {
    const doc = new jsPDF() as any;
    
    // App Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text('ERRAND RUNNER', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-400
    doc.text('OFFICIAL SHOPPING LIST', 20, 28);
    
    // Order Info
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    const errandId = errand.id ? errand.id.substring(0, 8).toUpperCase() : 'NEW';
    doc.text(`Order ID: ${errandId}`, 20, 45);
    doc.text(`Delivery Area: ${errand.pickupLocation || errand.pickup?.name || 'Not set'}`, 20, 52);
    doc.text(`Urgency: ${errand.urgency || 'Normal'}`, 20, 59);
    doc.text(`Shopping Budget: KSH ${errand.budget || 0}`, 20, 66);
    
    // Items Table
    const tableData = (errand.shoppingItems || []).map((item: string, index: number) => [
      index + 1,
      item,
      '' // Quantity/Check column
    ]);
    
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: 75,
        head: [['#', 'Item Description', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { cellWidth: 30 }
        }
      });
    }
    
    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Notes:', 20, finalY + 15);
    doc.setFontSize(9);
    doc.text(errand.shoppingList || 'No additional notes provided.', 20, finalY + 22, { maxWidth: 170 });
    
    doc.save(`shopping-list-${errandId.toLowerCase()}.pdf`);
  },

  downloadMamaFuaPDF: (errand: any) => {
    const doc = new jsPDF() as any;
    
    // App Header
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // blue-500
    doc.text('ERRAND RUNNER', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-400
    doc.text('MAMA FUA SERVICE RECEIPT', 20, 28);
    
    // Order Info
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    const errandId = errand.id ? (typeof errand.id === 'string' ? errand.id.substring(0, 8).toUpperCase() : 'NEW') : 'NEW';
    doc.text(`Order ID: ${errandId}`, 20, 45);
    doc.text(`Delivery Area: ${errand.pickup?.name || 'Not set'}`, 20, 52);
    doc.text(`Urgency: ${errand.urgency || 'Normal'}`, 20, 59);
    doc.text(`Total Service Fee: KSH ${errand.calculatedPrice || 0}`, 20, 66);
    
    // Task Summary Table
    const tableData = [
      ['Load Size', errand.loadSize || 'Not specified'],
      ['Service Types', (errand.serviceTypes || []).join(', ') || 'Not specified'],
      ['Detergent', errand.detergentProvided ? 'Provided by Client' : 'Runner Buys'],
      ['Water', errand.waterAvailability || 'Not specified'],
      ['Hanging', errand.hangingPreference || 'Not specified']
    ];
    
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: 75,
        head: [['Category', 'Details']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' }
        }
      });
    }
    
    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Instructions:', 20, finalY + 15);
    doc.setFontSize(9);
    doc.text(errand.description || 'No additional instructions provided.', 20, finalY + 22, { maxWidth: 170 });
    
    doc.save(`mama-fua-receipt-${errandId.toLowerCase()}.pdf`);
  }
};
