import { useState, useRef, useEffect } from 'react';
import './Expenses.css';
import { useAuth0 } from '@auth0/auth0-react';
// Gumloop Configuration
const GUMLOOP_API_KEY = import.meta.env.VITE_GUMLOOP_API_KEY || 'c74b5f4d4b8a4f0086a0ceccd7a2bc6b';
const GUMLOOP_USER_ID = import.meta.env.VITE_GUMLOOP_USER_ID || 'XURX5znR9YQQrJJRyzSRo5ExDJG3';
const GUMLOOP_SAVED_ITEM_ID = import.meta.env.VITE_GUMLOOP_SAVED_ITEM_ID || '5ktCd2DhH8WtW8UMdqZ2dY';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function Expenses() {
  const { user, isAuthenticated } = useAuth0();
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [mongoUserId, setMongoUserId] = useState(null);

  // Fetch MongoDB user ID from Auth0 sub
  useEffect(() => {
    const fetchUserId = async () => {
      if (isAuthenticated && user?.sub) {
        try {
          const response = await fetch(`${API_URL}/users/by-auth0/${encodeURIComponent(user.sub)}`);
          if (response.ok) {
            const userData = await response.json();
            setMongoUserId(userData._id);
          }
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
    };
    fetchUserId();
  }, [isAuthenticated, user]);

  // Poll for pipeline completion
  const pollForResult = async (runId) => {
    const maxAttempts = 60; // Max 2 minutes (2s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const pollUrl = `https://api.gumloop.com/api/v1/get_pl_run?run_id=${runId}&user_id=${GUMLOOP_USER_ID}`;
        const response = await fetch(pollUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${GUMLOOP_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Poll result:', result);

        if (result.state === 'DONE') {
          // Pipeline completed successfully
          return result.outputs;
        } else if (result.state === 'FAILED') {
          throw new Error('Pipeline execution failed');
        }

        // Still running, wait and try again
        setProcessingStatus(`Processing... (${Math.round((attempts / maxAttempts) * 100)}%)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (err) {
        console.error('Polling error:', err);
        throw err;
      }
    }

    throw new Error('Pipeline timed out');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset states
    setError(null);
    setExpenseData(null);
    setPreviewUrl(URL.createObjectURL(file));
    setIsProcessing(true);
    setProcessingStatus('Uploading image...');

    // Convert to base64 for Gumloop
    const base64 = await fileToBase64(file);

    try {
      // Step 1: Start the Gumloop pipeline
      setProcessingStatus('Starting AI analysis...');
      
      // Build URL with query parameters
      const startUrl = `https://api.gumloop.com/api/v1/start_pipeline?user_id=${GUMLOOP_USER_ID}&saved_item_id=${GUMLOOP_SAVED_ITEM_ID}`;
      
      const startResponse = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GUMLOOP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pipeline_inputs: [
            { 
              input_name: 'receipt_image', 
              value: base64 
            }
          ]
        })
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.message || 'Failed to start pipeline');
      }

      const startResult = await startResponse.json();
      console.log('Pipeline started:', startResult);

      // Step 2: Poll for results
      setProcessingStatus('Extracting expense data...');
      const outputs = await pollForResult(startResult.run_id);

      // Step 3: Parse the output - adjust based on your output node name
      // The output should be JSON from your Gumloop workflow
      let parsedData;
      
      // Gumloop returns outputs as an object with output names as keys
      // Adjust 'expense_data' to match your Output node's name in Gumloop
      const outputData = outputs?.expense_data || outputs?.output || Object.values(outputs)[0];
      
      if (typeof outputData === 'string') {
        // Try to parse if it's a JSON string
        try {
          parsedData = JSON.parse(outputData);
        } catch {
          // If not JSON, try to extract JSON from the string
          const jsonMatch = outputData.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Could not parse expense data from response');
          }
        }
      } else {
        parsedData = outputData;
      }

      // Set the expense data from Gumloop response
      setExpenseData({
        vendor_name: parsedData.vendor_name || '',
        date: parsedData.date || '',
        total_amount: parsedData.total_amount || '',
        tax_amount: parsedData.tax_amount || '',
        currency: parsedData.currency || 'USD',
        line_items: parsedData.line_items || []
      });

      setProcessingStatus('Done!');
    } catch (err) {
      console.error('Error processing receipt:', err);
      setError(err.message || 'Failed to process receipt. Please try again.');
      // Show empty form so user can fill manually
      setExpenseData({
        vendor_name: '',
        date: '',
        total_amount: '',
        tax_amount: '',
        currency: 'USD',
        line_items: []
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setExpenseData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setExpenseData(prev => {
      const newLineItems = [...prev.line_items];
      newLineItems[index] = { ...newLineItems[index], [field]: value };
      return { ...prev, line_items: newLineItems };
    });
  };

  const addLineItem = () => {
    setExpenseData(prev => ({
      ...prev,
      line_items: [...prev.line_items, { description: '', quantity: 1, unit_price: 0, total: 0 }]
    }));
  };

  const removeLineItem = (index) => {
    setExpenseData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Transform data to match backend schema
      const expensePayload = {
        userId: mongoUserId,
        vendorName: expenseData.vendor_name,
        date: expenseData.date ? new Date(expenseData.date).toISOString() : null,
        totalAmount: parseFloat(expenseData.total_amount) || 0,
        taxAmount: parseFloat(expenseData.tax_amount) || 0,
        currency: expenseData.currency,
        lineItems: expenseData.line_items.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unit_price) || 0,
          total: parseFloat(item.total) || 0
        })),
        receiptImageUrl: previewUrl || null
      };

      console.log('Saving expense:', expensePayload);

      const response = await fetch(`${API_URL}/expenses/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expensePayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save expense');
      }

      const savedExpense = await response.json();
      console.log('Expense saved:', savedExpense);
      
      setSaveSuccess(true);
      
      // Reset form after successful save
      setTimeout(() => {
        setExpenseData(null);
        setPreviewUrl(null);
        setSaveSuccess(false);
      }, 2000);

    } catch (err) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="expenses-container">
      <h1>📸 Scan Expense</h1>
      <p className="expenses-subtitle">Upload a receipt or expense image to automatically extract the data</p>

      <div className="expenses-content">
        {/* Upload Section */}
        <div className="upload-section">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            hidden
          />
          
          {!previewUrl ? (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">📤</div>
              <p>Click to upload receipt image</p>
              <span>or drag and drop</span>
            </div>
          ) : (
            <div className="preview-section">
              <img src={previewUrl} alt="Receipt preview" className="receipt-preview" />
              <button className="change-image-btn" onClick={() => fileInputRef.current?.click()}>
                Change Image
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="processing-overlay">
              <div className="spinner"></div>
              <p>{processingStatus || 'Processing receipt...'}</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Form Section */}
        {expenseData && (
          <form className="expense-form" onSubmit={handleSubmit}>
            <h2>Expense Details</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label>Vendor Name</label>
                <input
                  type="text"
                  name="vendor_name"
                  value={expenseData.vendor_name}
                  onChange={handleChange}
                  placeholder="Business name"
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  name="date"
                  value={expenseData.date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Amount</label>
                <input
                  type="number"
                  name="total_amount"
                  value={expenseData.total_amount}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Tax Amount</label>
                <input
                  type="number"
                  name="tax_amount"
                  value={expenseData.tax_amount}
                  onChange={handleChange}
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select name="currency" value={expenseData.currency} onChange={handleChange}>
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="line-items-section">
              <div className="line-items-header">
                <h3>Line Items</h3>
                <button type="button" className="add-item-btn" onClick={addLineItem}>
                  + Add Item
                </button>
              </div>

              {expenseData.line_items.map((item, index) => (
                <div key={index} className="line-item">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                    min="1"
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="Total"
                    value={item.total}
                    onChange={(e) => handleLineItemChange(index, 'total', e.target.value)}
                    step="0.01"
                  />
                  <button type="button" className="remove-item-btn" onClick={() => removeLineItem(index)}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="submit-btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Expense'}
            </button>
            
            {saveSuccess && (
              <div className="success-message">
                <span>✅</span> Expense saved successfully!
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default Expenses;
