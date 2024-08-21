//const express = require('express');
//const fetch = require('node-fetch');
import express from 'express';
import fetch from 'node-fetch';

const dotenv = await import('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3021;

app.use(express.json());

app.post('/extract-pdf', async(req,res)=>{
    const{pdfUrl} = req.body;

    try{
        const response = await fetch('https://pdf-services-ue1.adobe.io/operation/extractpdf',{
            method: 'POST',
            headers:{
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body:JSON.stringify({
                pdfUrl: pdfUrl,
                option:{
                    elementsToExtract: ['text', 'tables']
                }
            })
        });
        const data = await response.json();
        res.status(200).json(data);
    }catch(error){
        console.error('Error:', error);
        res.status(500).json({ error: 'Error xd' });
    }
});

//INICIALIZACION DEL SERVIDOR
app.listen(PORT, () =>{
    console.log(`Servidor jalando en http://localhost:${PORT}`);
});