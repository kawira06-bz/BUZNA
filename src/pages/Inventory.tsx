import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, generateUUID } from '../lib/db';
import { Product, Category, InventoryEventType, InventoryEvent } from '../types';
import { Plus, Search, Tag, Barcode, Calendar, Lock, ShieldAlert, Archive, Trash2 } from 'lucide-react';

export const Inventory: React.FC<{ addToast: (text: string, type: 'success' | 'error') => void }> = ({ addToast }) => {
  const { activeBusiness, activeUser } = useAuth();
  
  // Realtime lists
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Form toggles
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Category form inputs
  const [newCatName, setNewCatName] = useState('');

  // Product form inputs
  const [productName, setProductName] = useState('');
  const [productBarcode, setProductBarcode] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [costFloor, setCostFloor] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [initialQty, setInitialQty] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [supplierId, setSupplierId] = useState('');

  // Access validation: Write rights are restricted to OWNER and MANAGER only
  const canModifyCatalog = activeUser?.role === 'OWNER' || activeUser?.role === 'MANAGER';

  // Fetch products and categories
  const fetchData = async () => {
    try {
      const prods = await db.getAll<Product>('products');
      const cats = await db.getAll<Category>('product_categories');
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = db.subscribe(fetchData);
    return () => unsubscribe();
  }, []);

  // Handle Category Creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) {
      addToast('Category name is required.', 'error');
      return;
    }

    try {
      if (!activeBusiness) return;
      await db.addCategory(activeBusiness.tenantId, newCatName);
      addToast(`Category "${newCatName}" appended successfully!`, 'success');
      setNewCatName('');
      setShowCategoryModal(false);
    } catch (err: any) {
      addToast(err.message || 'Category setup failed.', 'error');
    }
  };

  // Handle Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !costFloor || !retailPrice) {
      addToast('Product name, cost price, and retail price are required.', 'error');
      return;
    }

    const cFloor = Number(costFloor);
    const rPrice = Number(retailPrice);

    if (rPrice < cFloor) {
      addToast(`Integrity Error: Retail price (KES ${rPrice}) cannot be set below cost floor price (KES ${cFloor}).`, 'error');
      return;
    }

    try {
      if (!activeBusiness) return;
      
      const productId = 'prod-' + generateUUID().substring(0, 8);
      const newProduct: Omit<Product, 'currentQuantity'> & { currentQuantity?: number } = {
        productId,
        tenantId: activeBusiness.tenantId,
        categoryId: productCategory || null,
        barcode: productBarcode || undefined,
        productName,
        costFloor: cFloor,
        retailPrice: rPrice,
        isSerialized: false,
        expiryDate: expiryDate || undefined,
        supplierId: supplierId || undefined,
        currentQuantity: initialQty ? Number(initialQty) : 0
      };

      await db.addProduct(newProduct);
      addToast(`Product "${productName}" integrated into stock ledger.`, 'success');
      
      // Clear inputs
      setProductName('');
      setProductBarcode('');
      setProductCategory('');
      setCostFloor('');
      setRetailPrice('');
      setInitialQty('');
      setExpiryDate('');
      setSupplierId('');
      
      setShowProductModal(false);
    } catch (err: any) {
      addToast(err.message || 'Product integration failed.', 'error');
    }
  };

  // Handle Delete Product (Only Owners)
  const handleDeleteProduct = async (prodId: string, name: string) => {
    if (activeUser?.role !== 'OWNER') {
      addToast('Permissions Blocked: Only business Owners are authorized to purge catalog items.', 'error');
      return;
    }

    if (confirm(`Purge catalog item "${name}"? This operation cannot be reversed.`)) {
      try {
        await db.delete('products', prodId);
        addToast(`Purged "${name}" from master index.`, 'success');
      } catch (err) {
        addToast('Delete operation failed.', 'error');
      }
    }
  };

  // Filter products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
    const matchesCat = selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6" id="inventory-view">
      
      {/* Upper header action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white uppercase tracking-tight">Master Catalog & Stock Ledger</h2>
          <p className="text-xs text-zinc-500 mt-1">Configure vertical stock, define profit margins, and track expiry dates</p>
        </div>

        {/* Lock Actions if Cashier is logged in */}
        {canModifyCatalog ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer flex items-center gap-1"
              style={{ minHeight: '44px' }}
              id="add-category-btn"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Category</span>
            </button>
            <button
              onClick={() => setShowProductModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
              style={{ minHeight: '44px' }}
              id="add-product-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Catalog Locked (Cashier mode)</span>
          </div>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center" id="inventory-filters">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search catalog by name or barcode scan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-sm"
          />
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Group:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none text-xs"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.categoryId} value={cat.categoryId}>{cat.categoryName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products table grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs" id="inventory-table-container">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                <th className="py-4 px-6">Product Details</th>
                <th className="py-4 px-4">Group</th>
                <th className="py-4 px-4">Cost Price</th>
                <th className="py-4 px-4">Retail Price</th>
                <th className="py-4 px-4">Markup Margin</th>
                <th className="py-4 px-4 text-center">In-Stock Qty</th>
                <th className="py-4 px-6 text-center">Purge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Archive className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                    <p className="text-sm font-semibold">No catalog matches found</p>
                    <p className="text-xs mt-1">Try broadening your queries or adding products.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const categoryObj = categories.find(c => c.categoryId === prod.categoryId);
                  const markup = prod.retailPrice - prod.costFloor;
                  const markupPct = ((markup / prod.costFloor) * 100).toFixed(0);

                  // Perishable indicator check
                  const isExpiringSoon = prod.expiryDate && new Date(prod.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

                  return (
                    <tr key={prod.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4 text-zinc-500" />
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-snug">{prod.productName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {prod.barcode && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                                  <Barcode className="w-3 h-3" />
                                  <span>{prod.barcode}</span>
                                </span>
                              )}
                              {prod.expiryDate && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isExpiringSoon 
                                    ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' 
                                    : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  <span>Exp: {new Date(prod.expiryDate).toLocaleDateString()}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {categoryObj?.categoryName || 'Uncategorized'}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-xs text-zinc-500 dark:text-zinc-400">
                        KES {prod.costFloor.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-sm text-zinc-900 dark:text-white">
                        KES {prod.retailPrice.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                          +KES {markup.toFixed(0)} ({markupPct}%)
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                          prod.currentQuantity <= 0 
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/20' 
                            : prod.currentQuantity < 10 
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20'
                              : 'bg-zinc-50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                        }`}>
                          {prod.currentQuantity.toLocaleString()} Units
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleDeleteProduct(prod.productId, prod.productName)}
                          disabled={activeUser?.role !== 'OWNER'}
                          className={`p-2 rounded-xl text-zinc-400 hover:text-red-600 disabled:opacity-30 cursor-pointer transition-all flex items-center justify-center mx-auto`}
                          style={{ minWidth: '44px', minHeight: '44px' }}
                          title="Purge product index"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD PRODUCT FORM */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="add-product-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Stock Ledger Onboarding</h3>
            
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Kabras Sugar 1Kg"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Barcode Standard / GTIN</label>
                  <input
                    type="text"
                    value={productBarcode}
                    onChange={(e) => setProductBarcode(e.target.value)}
                    placeholder="Scan or enter code"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Catalog Category *</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(cat => (
                      <option key={cat.categoryId} value={cat.categoryId}>{cat.categoryName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Cost Price (KES) *</label>
                  <input
                    type="number"
                    required
                    value={costFloor}
                    onChange={(e) => setCostFloor(e.target.value)}
                    placeholder="Buy price"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Retail Price (KES) *</label>
                  <input
                    type="number"
                    required
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    placeholder="Sell price"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Opening Stock Qty *</label>
                  <input
                    type="number"
                    required
                    value={initialQty}
                    onChange={(e) => setInitialQty(e.target.value)}
                    placeholder="Count"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Perishable Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    placeholder="e.g., Brookside Ltd"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-200 cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Onboard Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY FORM */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" id="add-category-modal">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider mb-4">New Category Setup</h3>
            
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g., Wholesale Bales"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl border border-zinc-200 cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md cursor-pointer"
                  style={{ minHeight: '44px' }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
