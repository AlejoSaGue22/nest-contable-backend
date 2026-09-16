export class DateUtil {
  /**
   * Parsea una fecha en formato string (DD/MM/YYYY o YYYY-MM-DD) a un objeto Date,
   * forzando la hora a medio día (T12:00:00) para evitar desfases de zona horaria 
   * que puedan causar que la fecha se guarde como el día anterior.
   */
  static parseLocalSafely(dateStr: string): Date {
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
    }

    // Si ya viene en formato YYYY-MM-DD
    const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(`${isoDate}T12:00:00`);
  }
}
