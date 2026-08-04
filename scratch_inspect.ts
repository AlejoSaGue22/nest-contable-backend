import { DataSource } from 'typeorm';

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'MySecr3tPassWord@as2',
    database: 'finance_tejo',
  });

  await dataSource.initialize();
  const res = await dataSource.query("SELECT * FROM periodos_nomina WHERE id = '6fbbb32a-cb57-4cb3-89e9-54ed410d265e'");
  console.log(res);
  await dataSource.destroy();
}

run();
