import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config.ts';

bootstrapWorker(config)
    .then(worker => worker.startJobQueue())
    .catch(err => {
        console.log(err);
    });
