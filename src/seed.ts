import { AppDataSource } from '../data-source';

async function runSeed() {
  try {
    console.log('🌱 Iniciando proceso de Seed...');

    // 1. Inicializar la conexión
    await AppDataSource.initialize();
    console.log('✅ Base de datos conectada.');

    // 2. Eliminar por completo el esquema actual (Borra todas las tablas y datos)
    console.log('🗑️ Vaciando la base de datos...');
    await AppDataSource.dropDatabase();

    // 3. Volver a sincronizar el esquema (Crea las tablas desde cero)
    console.log('🏗️ Recreando las tablas...');
    await AppDataSource.synchronize();

    console.log('🚀 ¡Seed completado con éxito! La base de datos está limpia.');
  } catch (error) {
    console.error('❌ Error durante el proceso de Seed:', error);
  } finally {
    // 4. Cerrar la conexión
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Conexión cerrada.');
    }
  }
}

runSeed();
