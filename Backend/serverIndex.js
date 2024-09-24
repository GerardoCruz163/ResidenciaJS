import express, { response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { dirname } from 'path';
import { clearInterval } from 'timers';
import cors from 'cors';
import { spawn } from 'child_process';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
app.use(express.json());

app.use(cors());
const storage = multer.memoryStorage();
const upload = multer({ dest: 'uploads/' });

//TOKEN DE ACCESO GLOBAL
let tokenAcceso='';
let tknACCESS='';
let preURIUrl='';
let assetID='';
let locationURL='';//OBTENIDA DE CREATEJOB
let downloadURI='';
let jsonGenerado='';

app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    console.log('Ruta /upload recibida')
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha proporcionado ningún archivo.' });
        }

        // Aquí procesas el archivo subido
        const filePath = req.file.path; // Ruta temporal del archivo subido
        const fileBuffer = fs.readFileSync(filePath); // Leemos el archivo subido
        
        // Simulamos lo que hace tu función uploadSamplePDF
        if (!preURIUrl) {
            throw new Error('URL de subida no disponible.');
        }

        await uploadAsset(preURIUrl, fileBuffer);

        await startServer();
        res.status(200).json({ message: 'Archivo PDF subido y procesado exitosamente.' });
    } catch (error) {
        console.error('Error al subir el archivo PDF:', error.message);
        res.status(500).json({ message: 'Error al procesar el archivo PDF.' });
    }
});

function leerTokenDeArchivo() {
    return new Promise((resolve, reject) => {
        fs.readFile('TOKEN_ACCESO.json', 'utf-8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData.TOKEN);
                } catch (parseErr) {
                    reject(parseErr);
                }
            }
        });
    });
}
//OBTENER TOKEN NUEVO
async function getToken(){
    try{
        //CLIENTID Y API_SECRET (PARAMETROS REQUERIDOS PARA LA PETICION)
        const clientId = process.env.API_KEY;
        const adobeApiSecret = process.env.API_SECRET;
        //ENDPOINT PARA OBTENER EL TOKEN NUEVO
        const endpoint = 'https://pdf-services-ue1.adobe.io/token';
        //PARAMETROS QUE NECESITA LA SOLICITUD DE UN NUEVO TOKEN
        const params=new URLSearchParams();
        params.append('client_id', clientId);
        params.append('client_secret', adobeApiSecret);
        //AQUI SE HACE LA SOLICITUD
        //COLOCO EL ENDPOINT DONDE SE ENVIA LA SOLICITUD Y SUS RESPECTIVOS PARAMETROS
        const response = await axios.post(endpoint, params);
        //GUARDO EL TOKEN EN LA VARIABLE GLOBAL
        tokenAcceso =response.data.access_token;
        //muestro el token nuevo en la consola
        console.log('Token de acceso nuevo: ',tokenAcceso);

        tknACCESS ={
            'TOKEN': tokenAcceso
        };
        const tkn=JSON.stringify(tknACCESS, null,2);
        fs.writeFile('TOKEN_ACCESO.json', tkn, 'utf-8',(err)=>{
            if (err) {
                console.error('Error al guardar el TOKEN:', err);
                return;
            }
            console.log('\nArchivo JSON token guardado\n');
        });
        return tokenAcceso;
    }catch(error){
        console.error('Error durante el proceso. Error: ', error);
        throw error;
    }
}  
//SOLICITUD A PRE URI
    async function preURI() {
    try {
        const preURIEndpoint = `https://pdf-services-ue1.adobe.io/assets`;
        const body = { 'mediaType': 'application/pdf' };
        //CREDENCIALES
        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        //SE REALIZA LA PETICION
        const response = await axios.post(preURIEndpoint, body, { headers });
        //SE OBTIENE EL PREURI URL Y ASSET ID
        preURIUrl = response.data.uploadUri;
        assetID=response.data.assetID;
        return preURIUrl;
    } catch (error) {
        //VERIFICAR SI EL TOKEN ES VALIDO O VIGENTE
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            //SI SE PRODUCE UN ERROR 401 O 403, ES PORQUE EL TOKEN NO ES VALIDO O YA VENCIO
            console.log('Token no valido. Generando uno nuevo\n');
            tokenAcceso = await getToken(); // GENERA UN NUEVO TOKEN Y REINTENTA LA PETICION
            return await preURI(); // Reintentar la solicitud con el nuevo token
        } else {
            console.error('Error durante la solicitud a /preURI:', error);
            throw error;
        }
    }
}
// CARGA DEL ARCHIVO
//SUBIR ARCHIVO
async function uploadAsset(uploadUri, fileBuffer){
    try{
        //SE INGRESA EN ENCABEZADO REQUERIDO
        const headers= {
            'Content-Type': 'application/pdf'
        };
        // SE REALIZA LA PETICION
        const response = await axios.put(uploadUri, fileBuffer, { headers });
        console.log('\nArchivo importado! ', response.status,'\n');
        console.log('');
    }catch(error) {
        console.error('Error al subir el archivo:', error.response ? error.response.data : error.message);
    }
}
//CARGA EL PDF DE EJEMPLO
async function uploadSamplePDF() {
    try {
        const sampleFilePath = path.join(__dirname, '/uploads/8f58c16373aae345478a137531026063');
        const fileBuffer = fs.readFileSync(sampleFilePath);
        
        if (!preURIUrl) {
            throw new Error('URL de subida no disponible.');
        }

        await uploadAsset(preURIUrl, fileBuffer);
        console.log('Archivo PDF de muestra subido exitosamente.');
    } catch (error) {
        console.error('Error al subir el archivo PDF de muestra:', error.message);
    }
}


async function createJob(assetID) {
    try {
        const endpoint = 'https://pdf-services-ue1.adobe.io/operation/extractpdf';
        const jobData = {
            assetID: assetID,
            getCharBounds: false,
            includeStyling: false,
            elementsToExtract: [
                'text',
                'tables'
            ],
            tableOutputFormat: 'xlsx',
            renditionsToExtract: [
                'tables',
                'figures'
            ],
            notifiers: [
                {
                    type: 'CALLBACK',
                    data: {
                        url: 'https://dummy.callback.org/',
                        headers: {
                            'x-api-key': 'dummykey',
                            'access-token': 'dummytoken'
                        }
                    }
                }
            ]
        };
        const headers = {
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY,
            'Content-Type': 'application/json'
        };
        //SE REALIZA LA PETICION
        const response = await axios.post(endpoint, jobData, { headers });
        const jobLocation = response.headers.location;
        //SE OBTIENE LOCATION URL
        locationURL = response.headers.location;
        console.log('Trabajo creado. Location:', jobLocation);
        return jobLocation;
    } catch (error) {
        console.error('Error al crear el trabajo:', error.response ? error.response.data : error.message);
    }
}

//getStatusJob
async function getStatusJob(locationURL){
    try{
        //CARGA DE CREDENCIALES
        const headers={
            'Authorization': `Bearer ${tokenAcceso}`,
            'x-api-key': process.env.API_KEY
        }
        //SE REALIZA LA PETICION
        const response = await axios.get(locationURL,{headers});
        //SE OBTIENE EL DOWNLOAD URI COMO RESPUESTA
        downloadURI=response.data.downloadUri;
        //downloadURI=response.data.downloadUri;
        return response.data;
    }catch(error){
        console.error('Error al obtener el estado del trabajo:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function pollJobStatus(locationUrl) {
    const interval = 5000; //Intervalo en milisegundos (5 segundos)
    const poll = setInterval(async () => {
        try {
            const status = await getStatusJob(locationUrl);

            // SE VERIFICA EL ESTADO DEL TRABAJO
            if (status.status === 'done') { 
                console.log('El trabajo ha finalizado.');
                //SE OBTIENE DOWNLOADURI
                downloadURI = status.content?.downloadUri || status.resource?.downloadUri;
                if (downloadURI) {
                    //SE REALIZA LA PETICION A DOWNLOAD ASSET
                    await downloadAsset(downloadURI);
                } else {
                    console.error('No se encontró un URI de descarga.');
                }
                clearInterval(poll); //SE DETIENE EL SONDEO CUANDO SE TERMINA EL PROCESO
            } else if (status.status === 'failed') { 
                console.error('El trabajo ha fallado.');
                clearInterval(poll); //DETENER EL SONDEO EN CASO DE FALLO
            } else {
                console.log('El trabajo aún está en progreso...'); //PROCESO DEL TRABAJO
            }
        } catch (error) {
            console.error('Error durante el sondeo del estado del trabajo:', error.message);
            clearInterval(poll);
        }
    }, interval);
}

function URLValida(string) {
    try {
        // Intentar crear un nuevo objeto URL con la cadena
        new URL(string);
        return true;
    } catch (_) {
        // Si falla, la cadena no es una URL válida
        return false;
    }
}

async function downloadAsset(downloadURI) {
    try {
        //VERIFICAR QUE LA URL SEA VALIDA
        if (!downloadURI || !URLValida(downloadURI)) {
            throw new Error(`URI de descarga Invalido: ${downloadURI}`);
        }
        //REALIZAR PETICION A LA URL
        const response = await axios.get(downloadURI);
        //SE OBTIENE EL JSON GENERADO
        jsonGenerado = JSON.stringify(response.data, null,2);
        //SE GENERA UN ARCHIVO JSON, DONDE SE GUARDARA EL JSON GENERADO Y SE GUARDA EN EL DIRECTORIO
        fs.writeFile('PDF_EXPORT.json', jsonGenerado, 'utf-8',(err)=>{
            if (err) {
                console.error('Error al guardar el archivo JSON:', err);
                return;
            }
            console.log('Archivo JSON guardado');
        });
        return response.data;
    } catch (error) {
        console.error('Error al descargar:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function startServer() {
    try {
        app.listen(port, () => {
            console.log(`Servidor en el puerto: ${port}`);
        });
        try {
            tokenAcceso = await leerTokenDeArchivo();
            console.log('Token leido del archivo: ', tokenAcceso);

            // Intentar hacer una petición a preURI con el token existente
            await preURI();  // Esto verificará si el token es válido
            console.log('Token valido, continuando con las demas peticiones...');
        } catch (error) {
            // Si hay un error, el token puede estar vencido o inválido, por lo tanto, generar uno nuevo
            console.log('Token no es válido o ha expirado. Generando un nuevo token...');
            tokenAcceso = await getToken();  // Generar y guardar un nuevo token
            await preURI();
        }
        await uploadSamplePDF();
        const jobLocation=await createJob(assetID);

        pollJobStatus(locationURL);
        //console.log(downloadURI);
        //downloadAsset(downloadURI);
    } catch (error) {
        console.error('Error al iniciar servidor: ', error);
    }
}
startServer();