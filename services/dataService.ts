
import { InventoryItem } from '../types';
import { INITIAL_INVENTORY } from '../constants';

const INVENTORY_KEY = 'hdu_inventory';

class DataService {
  private getStorageData<T>(key: string, initial: T[]): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : initial;
  }

  private setStorageData<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Inventory Logic
  getInventory(): InventoryItem[] {
    return this.getStorageData(INVENTORY_KEY, INITIAL_INVENTORY);
  }

  saveInventoryItem(item: InventoryItem): void {
    const items = this.getInventory();
    const index = items.findIndex(i => i.id === item.id);
    if (index > -1) {
      items[index] = item;
    } else {
      items.push(item);
    }
    this.setStorageData(INVENTORY_KEY, items);
  }

  deleteInventoryItem(id: string): void {
    const items = this.getInventory();
    const updated = items.filter(i => i.id !== id);
    this.setStorageData(INVENTORY_KEY, updated);
  }
}

export const dataService = new DataService();
