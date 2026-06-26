const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const DEFAULT_CSV_PATH = path.join(PROJECT_ROOT, 'data.csv');
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, 'docs-download');
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, '.env');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function normalizeBaseSharedPath(rawBasePath) {
  if (!rawBasePath) {
    throw new Error(
      'No se encontro BASE_SHARED_PATH. Definilo en el entorno o en el archivo .env.',
    );
  }

  return path.resolve(rawBasePath);
}

function parseCsvNumbers(csvContent) {
  return csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^"(.*)"$/, '$1').trim())
    .filter((value) => value && value.toLowerCase() !== 'numero');
}

function parseDocumentNumber(value) {
  const match = value.match(/^([^-]+)-(\d{4})-(\d+)-([^-]+)-(.+)$/);

  if (!match) {
    throw new Error(`Formato invalido: ${value}`);
  }

  const [, type, year, rawNumber, system, location] = match;
  const paddedNumber = rawNumber.padStart(8, '0');
  const millions = paddedNumber.substring(0, 2);
  const thousands = paddedNumber.substring(2, 5);
  const fileName = `${type}-${year}-${paddedNumber}-${system}-${location}`;
  const relativePath = path.join(
    year,
    location,
    millions,
    thousands,
    fileName,
    `${fileName}.pdf`,
  );

  return {
    value,
    type,
    year,
    number: paddedNumber,
    system,
    location,
    relativePath,
  };
}

async function ensureDirectory(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function copyDocument(baseSharedPath, outputRoot, documentInfo) {
  const sourcePath = path.join(baseSharedPath, documentInfo.relativePath);
  const destinationPath = path.join(outputRoot, documentInfo.relativePath);

  await ensureDirectory(path.dirname(destinationPath));
  await fs.promises.copyFile(sourcePath, destinationPath);

  return {
    sourcePath,
    destinationPath,
  };
}

async function main() {
  const envFile = loadEnvFile(DEFAULT_ENV_PATH);
  const baseSharedPath = normalizeBaseSharedPath(
    process.env.BASE_SHARED_PATH || envFile.BASE_SHARED_PATH,
  );
  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_CSV_PATH;
  const outputRoot = process.argv[3]
    ? path.resolve(process.argv[3])
    : DEFAULT_OUTPUT_ROOT;

  if (!fs.existsSync(csvPath)) {
    throw new Error(`No se encontro el CSV en: ${csvPath}`);
  }

  if (!fs.existsSync(baseSharedPath)) {
    throw new Error(
      `No existe la ruta base compartida configurada en BASE_SHARED_PATH: ${baseSharedPath}`,
    );
  }

  await ensureDirectory(outputRoot);

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const documentNumbers = parseCsvNumbers(csvContent);

  if (documentNumbers.length === 0) {
    console.log('El CSV no contiene numeros para procesar.');
    return;
  }

  const summary = {
    processed: 0,
    downloaded: 0,
    missing: [],
    invalid: [],
    failed: [],
  };

  console.log(`Base compartida: ${baseSharedPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Destino: ${outputRoot}`);
  console.log(`Documentos a procesar: ${documentNumbers.length}`);

  for (const documentNumber of documentNumbers) {
    summary.processed += 1;

    let documentInfo;
    try {
      documentInfo = parseDocumentNumber(documentNumber);
    } catch (error) {
      summary.invalid.push({
        numero: documentNumber,
        motivo: error.message,
      });
      console.warn(`[INVALIDO] ${documentNumber}: ${error.message}`);
      continue;
    }

    const sourcePath = path.join(baseSharedPath, documentInfo.relativePath);

    if (!fs.existsSync(sourcePath)) {
      summary.missing.push({
        numero: documentNumber,
        sourcePath,
      });
      console.warn(`[NO ENCONTRADO] ${documentNumber}`);
      continue;
    }

    try {
      const result = await copyDocument(baseSharedPath, outputRoot, documentInfo);
      summary.downloaded += 1;
      console.log(
        `[DESCARGADO] ${documentNumber} -> ${path.relative(PROJECT_ROOT, result.destinationPath)}`,
      );
    } catch (error) {
      summary.failed.push({
        numero: documentNumber,
        sourcePath,
        motivo: error.message,
      });
      console.error(`[ERROR] ${documentNumber}: ${error.message}`);
    }
  }

  const summaryPath = path.join(outputRoot, 'download-summary.json');
  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('');
  console.log('Resumen final');
  console.log(`Procesados: ${summary.processed}`);
  console.log(`Descargados: ${summary.downloaded}`);
  console.log(`No encontrados: ${summary.missing.length}`);
  console.log(`Invalidos: ${summary.invalid.length}`);
  console.log(`Errores: ${summary.failed.length}`);
  console.log(`Resumen JSON: ${summaryPath}`);

  if (summary.missing.length > 0 || summary.invalid.length > 0 || summary.failed.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
