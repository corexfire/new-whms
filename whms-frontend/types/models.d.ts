export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  base_uom: string;
  is_active: boolean;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
}

// Add more domain models as needed (PO, SO, GRN, etc.)
