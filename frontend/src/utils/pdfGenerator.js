import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Internal function to create the PDF document
function createPDFDocument(invoiceData, user, client) {
  const doc = new jsPDF()

  // Colors
  const primaryColor = [102, 126, 234] // #667eea (matching the app theme)
  const darkGray = [51, 51, 51]
  const lightGray = [102, 102, 102]

  const invoice = invoiceData.invoice || invoiceData
  const businessInfo = invoiceData.user || user || {}
  const clientInfo = invoiceData.client || client || {}

  // Header - Business Information
  doc.setFontSize(24)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.text(businessInfo.businessName || 'Invoice', 20, 25)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...lightGray)
  let yPos = 32

  if (businessInfo.businessAddress) {
    doc.text(businessInfo.businessAddress, 20, yPos)
    yPos += 5
  }
  if (businessInfo.businessPhone) {
    doc.text(businessInfo.businessPhone, 20, yPos)
    yPos += 5
  }
  if (businessInfo.businessEmail) {
    doc.text(businessInfo.businessEmail, 20, yPos)
    yPos += 5
  }

  // Invoice Number and Date (Right side)
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', 150, 25)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Invoice #: ${invoice.invoiceNumber || 'N/A'}`, 150, 32)
  
  if (invoice.issueDate) {
    doc.text(`Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 150, 37)
  }
  if (invoice.dueDate) {
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 150, 42)
  }
  
  doc.setTextColor(...primaryColor)
  doc.setFont('helvetica', 'bold')
  const status = (invoice.status || 'draft').toUpperCase()
  doc.text(`Status: ${status}`, 150, 47)

  // Bill To Section
  yPos = Math.max(yPos + 10, 55)
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO:', 20, yPos)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  yPos += 6
  
  if (clientInfo.name) {
    doc.text(clientInfo.name, 20, yPos)
    yPos += 5
  }
  if (clientInfo.email) {
    doc.setFontSize(9)
    doc.setTextColor(...lightGray)
    doc.text(clientInfo.email, 20, yPos)
    yPos += 5
  }
  if (clientInfo.address) {
    doc.text(clientInfo.address, 20, yPos)
    yPos += 5
  }

  // Invoice Title & Description
  if (invoice.invoiceTitle || invoice.invoiceDescription) {
    yPos += 5
    doc.setFontSize(9)
    doc.setTextColor(...lightGray)
    doc.setFont('helvetica', 'bold')
    if (invoice.invoiceTitle) {
      doc.text('Job/Project:', 20, yPos)
      yPos += 5
      doc.setFontSize(10)
      doc.setTextColor(...darkGray)
      doc.setFont('helvetica', 'normal')
      doc.text(invoice.invoiceTitle, 20, yPos)
      yPos += 5
    }
    if (invoice.invoiceDescription) {
      doc.setFontSize(9)
      doc.setTextColor(...lightGray)
      // Handle multi-line description
      const descriptionLines = doc.splitTextToSize(invoice.invoiceDescription, 150)
      descriptionLines.forEach(line => {
        doc.text(line, 20, yPos)
        yPos += 5
      })
    }
  }

  yPos += 10

  // Separate items into services and materials
  const services = []
  const materials = []

  if (invoice.lineItems && invoice.lineItems.length > 0) {
    invoice.lineItems.forEach(item => {
      // Check if it's a labor/service item (contains "labor", "hour", "service" in description)
      const desc = (item.description || '').toLowerCase()
      if (desc.includes('labor') || desc.includes('hour') || desc.includes('service') || desc.includes('time')) {
        services.push(item)
      } else {
        materials.push(item)
      }
    })
  }

  let servicesSubtotal = 0
  let materialsSubtotal = 0

  // Services Section
  if (services.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(...primaryColor)
    doc.setFont('helvetica', 'bold')
    doc.text('SERVICES', 20, yPos)
    yPos += 2

    const serviceRows = services.map(item => {
      const quantity = parseFloat(item.quantity || 0)
      const rate = parseFloat(item.rate || 0)
      const itemTotal = quantity * rate
      servicesSubtotal += itemTotal
      return [
        item.description || '',
        quantity.toString(),
        `$${rate.toFixed(2)}`,
        `$${itemTotal.toFixed(2)}`
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Quantity', 'Rate', 'Amount']],
      body: serviceRows,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        fontSize: 10,
        fontStyle: 'bold',
        textColor: [255, 255, 255]
      },
      styles: {
        fontSize: 9,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' }
      }
    })

    yPos = doc.lastAutoTable.finalY + 10

    // Services Subtotal
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    doc.setFont('helvetica', 'bold')
    doc.text('Services Subtotal:', 135, yPos)
    doc.text(`$${servicesSubtotal.toFixed(2)}`, 175, yPos, { align: 'right' })

    yPos += 12
  }

  // Materials Section
  if (materials.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(...primaryColor)
    doc.setFont('helvetica', 'bold')
    doc.text('MATERIALS', 20, yPos)
    yPos += 2

    const materialRows = materials.map(item => {
      const quantity = parseFloat(item.quantity || 0)
      const rate = parseFloat(item.rate || 0)
      const itemTotal = quantity * rate
      materialsSubtotal += itemTotal
      return [
        item.description || '',
        quantity.toString(),
        `$${rate.toFixed(2)}`,
        `$${itemTotal.toFixed(2)}`
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Quantity', 'Price', 'Amount']],
      body: materialRows,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        fontSize: 10,
        fontStyle: 'bold',
        textColor: [255, 255, 255]
      },
      styles: {
        fontSize: 9,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' }
      }
    })

    yPos = doc.lastAutoTable.finalY + 10

    // Materials Subtotal
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    doc.setFont('helvetica', 'bold')
    doc.text('Materials Subtotal:', 135, yPos)
    doc.text(`$${materialsSubtotal.toFixed(2)}`, 175, yPos, { align: 'right' })

    yPos += 12
  }

  // Calculate totals
  const subtotal = servicesSubtotal + materialsSubtotal
  // Use invoice total if available, otherwise calculate with tax
  const invoiceTotal = parseFloat(invoice.total || 0)
  const taxAmount = invoiceTotal > 0 && invoiceTotal !== subtotal ? invoiceTotal - subtotal : subtotal * 0.10
  const total = invoiceTotal > 0 ? invoiceTotal : subtotal + taxAmount

  // Totals Section
  yPos += 15
  doc.setDrawColor(200, 200, 200)
  doc.line(120, yPos, 190, yPos)
  yPos += 10

  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', 135, yPos)
  doc.text(`$${subtotal.toFixed(2)}`, 175, yPos, { align: 'right' })

  if (taxAmount > 0) {
    yPos += 8
    doc.text('Tax:', 135, yPos)
    doc.text(`$${taxAmount.toFixed(2)}`, 175, yPos, { align: 'right' })
  }

  yPos += 10
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(120, yPos - 2, 190, yPos - 2)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text('TOTAL:', 135, yPos + 3)
  doc.text(`$${total.toFixed(2)}`, 175, yPos + 3, { align: 'right' })

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(9)
  doc.setTextColor(...lightGray)
  doc.setFont('helvetica', 'italic')
  doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' })

  if (businessInfo.businessName) {
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated by ${businessInfo.businessName}`, 105, pageHeight - 15, { align: 'center' })
  }

  return doc
}

// Export function to download the PDF
export function generatePDF(invoiceData, user, client) {
  const doc = createPDFDocument(invoiceData, user, client)
  const invoice = invoiceData.invoice || invoiceData
  const invoiceNumber = invoice.invoiceNumber || 'Draft'
  doc.save(`Invoice-${invoiceNumber}.pdf`)
}

// Export function to get PDF as base64 string (for email attachments)
export async function generatePDFBase64(invoiceData, user, client) {
  const doc = createPDFDocument(invoiceData, user, client)
  // Get the PDF as base64 string (without the data:application/pdf;base64, prefix)
  const pdfBase64 = doc.output('datauristring').split(',')[1]
  return pdfBase64
}
