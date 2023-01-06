import { MessageImporter } from './MessageImporter';
import { ProcessImporter } from './ProcessImporter';
import { ScenarioImporter } from './ScenarioImporter';
import { FormImporter } from './FormImporter';
import { FullProcedureFile, ProcedureFile, ProcedureImport } from './types/Procedure';
import { CitopiaCommandPort } from '../citopia-broker/CitopiaCommandPort';
import { CitopiaLoggerPort } from '../citopia-broker/CitopialoggerPort';
import { AxiosResponse } from 'axios';
import { BUSINESS_UNITS_ACTIONS } from '../../moleculer/services/businessunits/businessunits.names';
import { JsonBusinessUnit } from '../grc360/BusinessUnit/types/JsonBusinessUnit';
import { ProcedureRepository } from '../grc360/Procedure';
import { Tenant } from '../grc360/Tenant';
import { ScenarioFile } from './types/Scenario';
import { isScenarioEvent } from '../grc360/Scenario/types/DSScenario';
import { FormFile } from './types/Form';
import { MessagePageFile, MessageTextFile } from './types/Message';
import { BusinessUnitRepository } from '../grc360/BusinessUnit';
import { bucketName, S3Manager } from '../services/s3/S3Manager';
import { DSProcedure } from '../grc360/Procedure/types/DSProcedure';
import { slugify } from '../../utils';
import { AxiosConfFactory, CitopiaAxiosConf } from '../authentication/AxiosConfFactory';
import { AxiosInstanceCreator } from '../authentication/AxiosInstanceCreator';

/**
 * Manage Camunda procedure
 * To use this, you should have set those environment variables:
 *  - SERVICES_URL
 *  - S3_PROCEDURE_PROCESS
 */
export class ProcedureImporter {
    private servicesUrl: string;
    private s3ProcedureProcess: string = 'procedure';
    private procedureRepo: ProcedureRepository;
    private buRepo: BusinessUnitRepository;

    constructor(
        private readonly loggerPort: CitopiaLoggerPort,
        private readonly commandPort: CitopiaCommandPort,
        private readonly axiosConfFactory: AxiosConfFactory,
        private readonly processImporter: ProcessImporter,
        private readonly formImporter: FormImporter,
        private readonly messageImporter: MessageImporter,
        private readonly scenarioImporter: ScenarioImporter
    ) {
        this.checkAndLoadEnvironmentVariables();
        this.procedureRepo = new ProcedureRepository(commandPort, loggerPort, axiosConfFactory);
        this.buRepo = new BusinessUnitRepository(commandPort, loggerPort, axiosConfFactory);
    }

    /**
     * This import a new procedure on a tenant, creating the process, the procedure, the forms, the messages and the scenarios.
     * @param tenantId Tenant to import the procedure on
     * @param procedure The json containing the procedure to import and everything with it (scenarios, messages, forms)
     * @param procedureVersion A version string, format X.Y
     * @param procedureOwnerId The bussiness unit that will be the owner of this procedure
     * @param procedureAssigneeId The BusinessUnit that will be used for all assignment
     */
    public async importProcedure(
        manager: S3Manager,
        tenantId: string,
        procedure: FullProcedureFile,
        procedureVersion: string,
        procedureOwnerId: string,
        procedureAssigneeId: string
    ) {
        // Get the axios config from the username/password
        const axiosConfigDS = await this.axiosConfFactory.getConf('digitalstate', {
            tenantId,
        });

        const axiosConfigFormio = await this.axiosConfFactory.getConf('formio', {
            tenantId,
        });

        // Replace some uuids in the procedure
        const baseProcedure = this.getBaseProcedure(procedureOwnerId, procedure.service, procedureVersion);

        // Importing all process needed by this procedure
        await this.importProcedureProcess(manager, tenantId, procedure.processS3Folders, axiosConfigDS);

        this.loggerPort.info(`Processes for procedure ${baseProcedure.slug} created on tenant ${tenantId}`);

        // Import the basic procedure
        const createdProcedure = await this.importBaseProcedure(tenantId, baseProcedure, procedure.categories, axiosConfigDS);

        this.loggerPort.info(`Procedure ${baseProcedure.slug} created on tenant ${tenantId}`);

        // Import the messages and forms of this procedure
        const [formsUuids, messagesUuids] = await Promise.all([
            this.formImporter.importForms(
                tenantId,
                createdProcedure.uuid,
                procedure.forms,
                procedureOwnerId,
                axiosConfigDS,
                axiosConfigFormio
            ),
            this.messageImporter.importMessages(
                tenantId,
                createdProcedure.uuid,
                procedureOwnerId,
                procedure.messages,
                baseProcedure.slug,
                axiosConfigDS
            ),
        ]);

        const scenariosUuids = await this.scenarioImporter.importScenarios(
            tenantId,
            createdProcedure.uuid,
            procedureOwnerId,
            procedureAssigneeId,
            procedure.scenarios,
            messagesUuids,
            formsUuids,
            baseProcedure.slug,
            axiosConfigDS
        );

        const newMessagesUuid = messagesUuids.map((uuids) => uuids.newUuid);
        const messagePageDatas = procedure.messages.pages.map((page) => page.data);
        await this.messageImporter.updateMessagesScenario(tenantId, newMessagesUuid, messagePageDatas, scenariosUuids, axiosConfigDS);

        return {
            procedureUuid: createdProcedure.uuid,
            scenariosUuids: Array.from(scenariosUuids.values()),
        };
    }

    public async exportProcedure(manager: S3Manager, tenantId: string, procedureUuid: string): Promise<FullProcedureFile> {
        // We'll need access to formio
        const axiosConfigFormio = await this.axiosConfFactory.getConf('formio', {
            tenantId,
        });
        // We'll also need access to DS
        const axiosConfigDS = await this.axiosConfFactory.getConf('digitalstate', {
            tenantId,
        });
        // Retrieving the basic procedure
        const procedure = await this.procedureRepo.get(procedureUuid, { tenant: new Tenant(tenantId) });

        if (!procedure) {
            throw new Error(`Procedure with uuid ${procedureUuid} was not found on tenant ${tenantId}`);
        }

        // Exporting rubriques
        const axios = AxiosInstanceCreator.createInstanceFromConf(axiosConfigDS);
        const categories = await Promise.all(
            procedure.categories.map(async (categoryUrl) => {
                // procedure.categories format is ["/categories/uuid"]
                const uuid = categoryUrl.split('/').pop() as string;
                const category = await axios.get<{ title: { fr: string; en: string } }>(`${this.servicesUrl}/categories/${uuid}`, {
                    headers: {
                        Accept: 'application/json',
                    },
                });
                return category.data.title?.fr ?? category.data.title?.en;
            })
        ).catch((err) => {
            this.loggerPort.warn(`Could not retrieve some category during export: ${err}`);
            return [];
        });

        // Counting object to have pretty uuids in the json file
        let scenarioNb = 0;
        let formNb = 0;
        let messageNb = 0;
        const scenarioFiles: Array<ScenarioFile> = [];
        const formFiles: Array<FormFile> = [];
        // Old page uuid to new page uuid
        const pageUuidMapping: Map<string, string> = new Map();
        const pageFiles: Array<MessagePageFile> = [];
        const textFiles: Array<MessageTextFile> = [];
        const processes: Array<string> = [];
        // Looping through all scenarios to retrieve (usually only one)
        for (const scenario of procedure.scenarios) {
            scenarioNb++;
            // A bpm scenario have at least one form
            formNb++;
            // In DS, procedure.scenarios is something like ['/scenarios/uuid']
            const scenarioId = scenario.split('/').pop() as string;

            // Retrieving the scenario
            let scenarioFile: ScenarioFile;
            try {
                scenarioFile = await this.scenarioImporter.exportScenario(tenantId, scenarioId, scenarioNb, formNb);
            } catch (err) {
                this.loggerPort.warn(
                    `Scenario ${scenarioId} does not exist, skipping it from export of procedure ${procedure.uuid}: ${err}`
                );
                continue;
            }
            scenarioFiles.push(scenarioFile);

            if (scenarioFile.type !== 'bpm') {
                // No formUuid was written on the scenario
                formNb--;
                // No need to import anything else if the scenario is not a bpm one
                continue;
            }

            // Adding the process of this scenario to the list of processes used by the procedure
            const slugProcess = slugify(scenarioFile.config.process_custom_data.value.bpm);
            if (!slugProcess) {
                throw new Error(`Slug for ${scenarioFile.config.process_custom_data.value.bpm} is empty`);
            }
            switch (slugProcess) {
                case 'process-unetache':
                    processes.push('process-une-tache');
                    break;
                default:
                    processes.push(slugProcess);
            }

            // In DS, the formio key is something like 'formio:uuid'
            const formInitKey = scenarioFile.config.form_key.split(':').pop() as string;
            // Retrieving the main form of the scenario
            const formInit = await this.formImporter.exportForm(tenantId, formInitKey, formNb, true, axiosConfigFormio);
            scenarioFile.config.form_key = `formio:${formInit.config.path}`;
            formFiles.push(formInit);

            // Looping through every event of this scenario to retrieve forms
            for (const eventKey in scenarioFile.config.process_custom_data.value) {
                const event = scenarioFile.config.process_custom_data.value[eventKey];
                if (!isScenarioEvent(event)) {
                    continue;
                }

                // This event have an associated message page
                if (event.communications) {
                    for (const communication of event.communications) {
                        const pageId = communication.templateMessage;
                        if (pageUuidMapping.has(pageId)) {
                            // Template already exported
                            communication.templateMessage = pageUuidMapping.get(pageId) ?? pageId;
                            continue;
                        }

                        messageNb++;

                        try {
                            const [pageFile, textFile] = await this.messageImporter.exportMessage(
                                tenantId,
                                pageId,
                                scenarioFile.uuid,
                                messageNb,
                                axiosConfigDS
                            );

                            // Relinking the scenario and the message
                            communication.templateMessage = pageFile.uuid;

                            pageUuidMapping.set(pageId, pageFile.uuid);
                            pageFiles.push(pageFile);
                            textFiles.push(textFile);
                        } catch (err) {
                            this.loggerPort.warn(`Message page ${pageId} does not exist, skipping it from export: ${err}`);
                            messageNb--;
                        }
                    }
                }

                // This event generate a document, and might send a communication with it
                if (event.tabGenerateDoc) {
                    for (const tabValue of event.tabGenerateDoc.tabValues) {
                        const pageId = tabValue.modelMessageUuid;
                        if (pageUuidMapping.has(pageId)) {
                            // Template already exported
                            tabValue.modelMessageUuid = pageUuidMapping.get(pageId) ?? pageId;
                        } else {
                            messageNb++;
                            try {
                                // Exporting template
                                const [pageFile, textFile] = await this.messageImporter.exportMessage(
                                    tenantId,
                                    tabValue.modelMessageUuid,
                                    scenarioFile.uuid,
                                    messageNb,
                                    axiosConfigDS
                                );
                                tabValue.modelMessageUuid = pageFile.uuid;

                                pageUuidMapping.set(pageId, pageFile.uuid);
                                pageFiles.push(pageFile);
                                textFiles.push(textFile);
                            } catch (err) {
                                this.loggerPort.warn(`Document template ${pageId} does not exist, skipping it from export: ${err}`);
                                messageNb--;
                            }
                        }

                        if (tabValue.optionsActionsValue === 'send_comm' && tabValue.optionsActionCommunicationValue) {
                            // This document generation also sends a communication, we should export it

                            const pageId2 = tabValue.optionsActionCommunicationValue.templateMessage;
                            if (pageUuidMapping.has(pageId2)) {
                                // Template already exported
                                tabValue.optionsActionCommunicationValue.templateMessage = pageUuidMapping.get(pageId2) ?? pageId2;
                                continue;
                            }

                            messageNb++;
                            try {
                                const [pageFile2, textFile2] = await this.messageImporter.exportMessage(
                                    tenantId,
                                    tabValue.optionsActionCommunicationValue.templateMessage,
                                    scenarioFile.uuid,
                                    messageNb,
                                    axiosConfigDS
                                );
                                tabValue.optionsActionCommunicationValue.templateMessage = pageFile2.uuid;

                                pageUuidMapping.set(pageId2, pageFile2.uuid);
                                pageFiles.push(pageFile2);
                                textFiles.push(textFile2);
                            } catch (err) {
                                this.loggerPort.warn(`Document linked message ${pageId2} does not exist, skipping it from export: ${err}`);
                                messageNb--;
                            }
                        }
                    }
                }

                // This event have an associated form
                if (event.formio) {
                    formNb++;
                    // In DS, the formio key is something like 'formio:uuid'
                    const formioKey = event.formio.split(':').pop() as string;
                    const form = await this.formImporter.exportForm(tenantId, formioKey, formNb, false, axiosConfigFormio);
                    // Updating the link between the scenario and this form, since we're rewritting uuids
                    event.formio = `formio:${form.config.path}`;

                    formFiles.push(form);
                }
            }
        }

        // Retrieving the business unit, we're interested in the name only
        const ownerBu = await this.buRepo.get(procedure.ownerUuid, { tenant: new Tenant(tenantId) });

        // We should reupload all images of messages, we don't want them to be tenant or cluster specific
        const replacedTextFiles = await this.messageImporter.reuploadImages(manager, textFiles, procedure.slug);

        // Last thing, we need to reuplod the procedure image, we don't want a tenant depending on another one
        if (procedure.data.fr.image) {
            const link = procedure.data.fr.image.url;
            // Only if the image is hosted on our backend
            if (link.includes('monespacecitoyen.fr') || link.includes('grc360.fr')) {
                const newLink = await this.messageImporter
                    .reuploadImage(manager, link, procedure.slug)
                    .catch((err) => this.loggerPort.warn(err));

                // Replacing the image if we successfully reuploaded it
                if (newLink) {
                    procedure.data.fr.image = {
                        ...procedure.data.fr.image,
                        url: newLink,
                        path: '',
                    };
                }
            }
        }

        return {
            service: {
                slug: procedure.slug,
                title: procedure.title,
                presentation: procedure.presentation,
                description: procedure.description,
                data: procedure.data,
            },
            scenarios: scenarioFiles,
            messages: {
                pages: pageFiles,
                texts: replacedTextFiles,
            },
            forms: formFiles,
            categories,
            processS3Folders: processes,
            businessUnitName: ownerBu?.title?.fr ?? `Service ${procedure.title.fr}`,
        };
    }

    /**
     * Check that this class has all the environment variables it needs to run correctly,
     * and load those ENV has public properties of the class
     */
    public checkAndLoadEnvironmentVariables() {
        if (!process.env.SERVICES_URL) {
            throw new Error('ProcedureImporter is not correctly configured, one of those environment variables is not set: SERVICES_URL');
        }

        this.servicesUrl = process.env.SERVICES_URL;
    }

    /**
     * Get a basic procedure that can be imported on camunda
     * @param procedureOwnerId The uuid that owns the procedure (a BusinessUnit uuid)
     * @param procedure The procedure to import
     * @returns Will return a procedure stripped from useless properties (like uuids and such)
     */
    private getBaseProcedure(procedureOwnerId: string, procedure: ProcedureFile, procedureVersion: string): ProcedureImport {
        return {
            owner: 'BusinessUnit',
            ownerUuid: procedureOwnerId,
            slug: procedure.slug,
            title: procedure.title,
            description: procedure.description,
            presentation: procedure.presentation,
            data: {
                fr: {
                    ...procedure.data.fr,
                    // Overwriting the config, so the procedure won't be incorrectly tagged as configured after import
                    config: undefined,
                    // This is the version we save, format major.minor (like 4.6)
                    procedureVersion: procedureVersion,
                },
                en: procedure.data.en,
            },
            version: 1,
        };
    }

    /**
     * Upload a basic procedure to DS
     * @param tenantId Tenant linked to this procedure
     * @param procedure The JSON containing the base procedure to import
     * @param categoriesTitle Titles of rubriques of this procedure
     * @param config Axios config to send request
     * @returns The result of the send
     */
    private async importBaseProcedure(
        tenantId: string,
        procedure: ProcedureImport,
        categoriesTitle: Array<string>,
        config: CitopiaAxiosConf
    ): Promise<DSProcedure> {
        const axios = AxiosInstanceCreator.createInstanceFromConf(config);

        // Checking if the slug is already used
        const slug = procedure.slug;
        const title = procedure.title;
        let checkingSlug = slug;
        let newTitle = title;
        let suffix = 2;
        let found = true;
        while (found) {
            const existing = await axios
                .get<Array<{ uuid: string }>>(`${this.servicesUrl}/services?slug=${checkingSlug}`, {
                    headers: {
                        Accept: 'application/json',
                    },
                })
                .catch((err) => {
                    throw new Error(`Failed to check if slug ${checkingSlug} exists during import: ${err}`);
                });
            if (existing.data.length === 0) {
                // This slug is free
                found = false;
            } else {
                // This slug is taken, we try with a new one until we found something free
                checkingSlug = `${slug}-${suffix}`;
                // Also changing the title of the procedure, or else we will have a hard time finding the new one
                newTitle = {
                    fr: `${title.fr} ${suffix}`,
                    en: `${title.en} ${suffix}`,
                };
                suffix++;
            }
        }
        procedure.slug = checkingSlug;
        procedure.title = newTitle;

        const categories: Array<string> = [];
        // Retrieving categories only if we need them
        if (categoriesTitle.length > 0) {
            const allCategories = await axios
                .get<Array<{ uuid: string; title: { fr: string; en: string }; slug: string }>>(
                    `${this.servicesUrl}/categories?_limit=100`,
                    {
                        headers: {
                            Accept: 'application/json',
                        },
                    }
                )
                .catch((err) => {
                    throw new Error(`Failed to get all rubriques: ${err}`);
                });
            const allSlugs = allCategories.data.map((category) => category.slug);

            // Importing all categories
            for (const categoryTitle of categoriesTitle) {
                // Checking if the category might already exist
                let category = allCategories.data.find((cat) => cat.title.fr === categoryTitle);

                // This does not exist on the current tenant, we should create it
                if (!category) {
                    const backOfficeBus = await this.commandPort.runCommand(BUSINESS_UNITS_ACTIONS.GET_MANY, {
                        tenantId,
                        title: 'Backoffice',
                    });
                    const backOfficeBu = backOfficeBus.pop();
                    if (!backOfficeBu) {
                        throw Error('Backoffice BU not found, this is not normal');
                    }

                    // Maybe the category does not exist, but the slug might be taken
                    const baseSlug = slugify(categoryTitle);
                    if (!baseSlug) {
                        throw new Error(`Slug for ${categoryTitle} is empty`);
                    }
                    let categorySlug = baseSlug;
                    let nbSlug = 1;
                    // Adding a number to the slug and incrementing it until the slug is free to use
                    while (allSlugs.includes(categorySlug)) {
                        categorySlug = `${baseSlug}-${nbSlug++}`;
                    }

                    const title = { fr: categoryTitle, en: categoryTitle };
                    category = (
                        await axios
                            .post<{ uuid: string; title: { fr: string; en: string }; slug: string }>(
                                `${this.servicesUrl}/categories`,
                                {
                                    owner: 'BusinessUnit',
                                    ownerUuid: backOfficeBu.uuid,
                                    slug: categorySlug,
                                    title,
                                    description: title,
                                    presentation: title,
                                    data: { fr: {}, en: {} },
                                    services: [],
                                    enabled: true,
                                    version: 1,
                                },
                                {
                                    headers: {
                                        Accept: 'application/json',
                                        'Content-Type': 'application/json',
                                    },
                                }
                            )
                            .catch((err) => {
                                throw new Error(`Failed to import category ${categoryTitle}: ${err}`);
                            })
                    ).data;

                    this.loggerPort.info(`Imported rubrique ${category.title.fr} (slug: ${category.slug}) on tenant ${tenantId}`);
                }

                // Adding the category to the procedure
                categories.push(`/categories/${category.uuid}`);
            }
        }

        // @ts-ignore
        procedure.categories = categories;
        try {
            const response = await axios.post<DSProcedure>(`${this.servicesUrl}/services`, procedure, {
                headers: {
                    'X-Tenant': tenantId,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (err) {
            throw new Error(`Failed to import base procedure on ${this.servicesUrl}/services: ${err}`);
        }
    }

    /**
     * Import the process linked to the procedure
     * @param tenantId Tenant linked to this procedure
     * @param processFolders S3 folders where each process can be found
     * @param config Axios config to send request
     */
    private async importProcedureProcess(manager: S3Manager, tenantId: string, processFolders: Array<string>, config: CitopiaAxiosConf) {
        let processes: Awaited<ReturnType<typeof manager.getLastVersionedObjectKeys>>;
        if (!process.env.S3_BUCKET_PROCESS) {
            throw new Error('Process object storage not configured, one of those environment variables is not set: S3_BUCKET_PROCESS');
        }
        try {
            processes = await manager.getLastVersionedObjectKeys(bucketName.process, this.s3ProcedureProcess);
        } catch (err) {
            throw new Error(`Failed to retrieve processes keys from S3: ${err}`);
        }
        const importPromises: Array<Promise<unknown>> = [];

        for (const processFolder of processFolders) {
            const grcProcess = processes.get(processFolder);

            if (!grcProcess) {
                throw new Error(`Process ${processFolder} has not been found, impossible to import it`);
            }

            // Retrieve BackOffice BU (Bureau)
            const bureauBUs = await this.commandPort.runCommand(BUSINESS_UNITS_ACTIONS.GET_MANY, {
                tenantId,
                title: 'Backoffice',
            });
            const bureauBU = bureauBUs.shift();
            if (!bureauBU) {
                throw new Error(`Business unit 'Backoffice' not found`);
            }
            const promise = manager
                .getFiles(bucketName.process, grcProcess.lastObjects)
                .catch((err) => {
                    throw new Error(`Failed to retrieve S3 files of process ${processFolder}: ${err}`);
                })
                .then(async (files) => {
                    let processCreated: AxiosResponse;
                    try {
                        processCreated = await this.processImporter.importProcess(tenantId, processFolder, files, config);
                    } catch (err) {
                        throw new Error(`Failed to import process ${processFolder}: ${err}`);
                    }
                    try {
                        await this.importProcedureProcessMetadata(tenantId, processCreated, bureauBU, config);
                    } catch (err) {
                        throw new Error(`Failed to import metadata of process ${processFolder}: ${err}`);
                    }
                    return processCreated;
                });

            importPromises.push(promise);
        }

        return Promise.all(importPromises);
    }

    /**
     * Import metadata linked to the procedure
     * @param tenantId Tenant linked to this procedure
     * @param process Process to update metadata
     * @param config Axios config to send request
     */
    private async importProcedureProcessMetadata(
        tenantId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process: any,
        bu: JsonBusinessUnit,
        config: CitopiaAxiosConf
    ): Promise<void> {
        const axios = AxiosInstanceCreator.createInstanceFromConf(config);
        if (process && process.data) {
            const deployedProcessDefinitions = process.data?.deployedProcessDefinitions;
            const keyDeployedProcessDefinitions = Object.keys(deployedProcessDefinitions)?.[0];
            if (keyDeployedProcessDefinitions) {
                const deploymentKey = deployedProcessDefinitions[keyDeployedProcessDefinitions].key;
                const slug = slugify(`${tenantId}_${deploymentKey}`);

                // Checking if the metadata already exist (happens if the process was already imported for another procedure)
                const metadata = await axios.get(`${this.servicesUrl}/metadata?slug=${slug}`, {
                    headers: {
                        Accept: 'application/json',
                    },
                });
                if (metadata.data.length > 0) {
                    // If we found something, it means we don't have to create it
                    return;
                }

                const xml = await this.processImporter.getProcessXml(tenantId, config, deploymentKey);
                const listUserTask = this.processImporter.getProcessUserTasks(xml);
                const descBpmn = this.processImporter.getBpmnDecriptionFromBpmnFile(xml.bpmn20Xml);
                const version = this.processImporter.getBpmnVersionFromBpmnFile(xml.bpmn20Xml);

                try {
                    await axios.post(`${this.servicesUrl}/metadata`, {
                        owner: 'BusinessUnit',
                        ownerUuid: bu.uuid,
                        data: {
                            tasks: listUserTask,
                            description: descBpmn,
                            version,
                        },
                        slug,
                        type: 'CamundaDeployment',
                        title: { en: slug, fr: slug },
                        version: 1,
                        tenant: tenantId,
                    });
                } catch (e) {
                    throw new Error(`Failed to create service metadata: ${e.message}`);
                }
            }
        }
    }
}
