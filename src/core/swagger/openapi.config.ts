import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import type {
  ParameterObject,
  ReferenceObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Single source of truth for the served and exported OpenAPI documents. */
export function createOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  const config = new DocumentBuilder()
    .setTitle('Dori API')
    .setDescription(
      "Spécification de référence de la plateforme de gestion de files d'attente et de rendez-vous Dori",
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Environnement local de développement')
    .addServer(
      'https://dori-api-dev.vercel.app',
      'Environnement distant de développement',
    )
    .addServer('https://dori-api.vercel.app', 'Environnement de production')
    .addTag('Authentification', 'Authentification, sessions et mots de passe')
    .addTag('Sites', 'Gestion des sites et affectation des gestionnaires')
    .addTag('Queues', "Gestion et configuration des files d'attente")
    .addTag('QueueEngine', "Moteur d'ordonnancement et pilotage des appels")
    .addTag('Registrations', 'Inscriptions, prise de tickets et suivi')
    .addTag('Persons', 'Gestion des profils usagers et historiques')
    .addTag('Users', 'Gestion des comptes utilisateurs et permissions')
    .addTag('Notifications', 'Gestion et envoi des notifications')
    .addTag('Tiers', 'Gestion des forfaits et priorités de service')
    .addTag('Translations', 'Gestion des traductions et bundles')
    .addTag('Reports', "Rapports statistiques et indicateurs d'activité")
    .addTag('Health', 'Santé des composants et dépendances')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Token JWT d'accès",
      },
      'bearer',
    )
    .addCookieAuth(
      'refreshToken',
      { type: 'apiKey', in: 'cookie', description: 'Refresh token HttpOnly' },
      'refresh-cookie',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Registration-Token',
        in: 'header',
        description: 'Jeton public de suivi de position',
      },
      'registration-token',
    )
    .build();
  config.info.contact = { name: 'Dori Support' };
  config.info.license = { name: 'Propriétaire' };
  return config;
}

/** Applies scalar conventions that cannot drift between individual DTOs. */
export function normalizeOpenApiDocument(
  document: OpenAPIObject,
): OpenAPIObject {
  const calendarDatePattern = '^\\d{4}-\\d{2}-\\d{2}$';
  const humanize = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase();
  const propertyDescriptions: Record<string, string> = {
    isActive: 'Indique si la ressource est active.',
    deletedAt:
      'Date de désactivation de la ressource, ou null si elle est active.',
    createdAt: 'Date de création.',
    updatedAt: 'Date de dernière modification.',
    dateFrom: 'Première date incluse dans la période.',
    dateTo: 'Dernière date incluse dans la période.',
    timezone: 'Fuseau horaire IANA utilisé pour les calculs temporels.',
    page: 'Numéro de la page courante.',
    pageSize: "Nombre d'éléments par page.",
    total: "Nombre total d'éléments.",
    totalPages: 'Nombre total de pages.',
  };
  const parameterDescriptions: Record<string, string> = {
    page: 'Numéro de page, à partir de 1.',
    pageSize: "Nombre d'éléments par page, entre 1 et 100.",
    siteId: 'Identifiant du site.',
    queueId: 'Identifiant de la file.',
    personId: 'Identifiant de la personne.',
    tierId: 'Identifiant du forfait de service.',
    dateFrom: 'Première date incluse au format YYYY-MM-DD.',
    dateTo: 'Dernière date incluse au format YYYY-MM-DD.',
    isActive:
      'true retourne les ressources actives, false les ressources désactivées.',
    granularity: 'Granularité des périodes : jour, semaine ou mois.',
    includeEmpty: 'Inclure les périodes sans activité.',
    groupBy: 'Dimension optionnelle de regroupement.',
    entryType: "Type d'entrée : sans rendez-vous ou rendez-vous.",
    appointmentStatus: 'Statut du rendez-vous.',
    scheduledTime: 'Date et heure planifiées au format ISO 8601.',
    'if-none-match': 'ETag reçu lors du précédent téléchargement du bundle.',
  };
  const operationRules: Record<string, string> = {
    ReportsController_getSeries:
      ' Exactement un périmètre doit être fourni : queueIds ou siteId. La période est inclusive, ordonnée et limitée à 366 jours.',
    RegistrationsController_findRegistrations:
      ' dateFrom et dateTo doivent être fournies ensemble. Une recherche par période exige queueId ou siteId et couvre au maximum 366 jours.',
    NotificationsController_findNotifications:
      ' dateFrom et dateTo doivent être fournies ensemble et couvrent au maximum 366 jours.',
    RegistrationsController_getAvailability:
      ' La période est inclusive et limitée à 62 jours en détail, ou 366 jours avec summaryOnly=true.',
  };
  const inactiveListOperations = new Set([
    'SitesController_findSites',
    'QueuesController_findAll',
    'RegistrationsController_findRegistrations',
    'PersonsController_findPersons',
    'PersonsController_getNotes',
    'UsersController_findUsers',
    'TranslationsController_getBundle',
    'TranslationsController_findTranslations',
  ]);
  const inactiveDirectPath =
    /^\/api\/v1\/(sites|queues|registrations|persons|users|translations)\/\{[^}]+\}(?:\/notes\/\{[^}]+\})?$/;
  const sortFields: Record<string, string[]> = {
    PersonsController_findPersons: [
      'personId',
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
      'createdAt',
      'updatedAt',
    ],
    PersonsController_getNotes: ['noteId', 'createdAt', 'updatedAt'],
    NotificationsController_findNotifications: [
      'notificationId',
      'channel',
      'notificationStatus',
      'sentAt',
      'createdAt',
    ],
    RegistrationsController_findRegistrations: [
      'registrationId',
      'ticketNumber',
      'businessDate',
      'status',
      'scheduledTime',
      'createdAt',
      'priorityReferenceTime',
    ],
    QueuesController_findAll: [
      'queueId',
      'queueName',
      'queueCode',
      'createdAt',
      'updatedAt',
      'siteName',
    ],
    QueuesController_getOperators: [
      'userId',
      'username',
      'email',
      'assignedAt',
    ],
    QueueEngineController_getActiveSessions: [
      'connectedAt',
      'sessionId',
      'threadNumber',
      'mode',
      'username',
    ],
    ServiceTiersController_findTiers: [
      'tierId',
      'tierName',
      'tierCode',
      'createdAt',
      'updatedAt',
    ],
    ServiceTiersController_getQueueTiers: [
      'displayOrder',
      'tierId',
      'price',
      'createdAt',
    ],
    ServiceTiersController_getRules: ['ruleId', 'createdAt', 'updatedAt'],
    SitesController_findSites: [
      'siteId',
      'siteName',
      'siteType',
      'createdAt',
      'updatedAt',
    ],
    SitesController_getManagers: ['userId', 'username', 'email', 'assignedAt'],
    TranslationsController_findTranslations: [
      'translationId',
      'category',
      'locale',
      'translationKey',
      'createdAt',
      'updatedAt',
    ],
    UsersController_findUsers: [
      'userId',
      'username',
      'email',
      'userType',
      'isActive',
      'lastLogin',
      'createdAt',
      'updatedAt',
    ],
  };
  for (const schema of Object.values(document.components?.schemas ?? {})) {
    if (!schema || '$ref' in schema || !schema.properties) continue;
    for (const [name, property] of Object.entries(schema.properties)) {
      if (!property) continue;
      if ('$ref' in property) {
        schema.properties[name] = {
          allOf: [property],
          description:
            propertyDescriptions[name] ??
            `Valeur du champ « ${humanize(name)} ».`,
        };
        continue;
      }
      property.description ??=
        propertyDescriptions[name] ?? `Valeur du champ « ${humanize(name)} ».`;
      if (
        /Id$/.test(name) &&
        ['integer', 'number'].includes(property.type ?? '')
      ) {
        property.minimum ??= 1;
      }
      if (property.type === 'string' && !property.format) {
        if (/^(businessDate|birthDate|date)$/.test(name))
          property.format = 'date';
        if (
          /(At|Time)$/.test(name) &&
          !/^(workingHoursStart|workingHoursEnd|breakStart|breakEnd)$/.test(
            name,
          )
        ) {
          property.format = 'date-time';
        }
      }
      if (
        property.type === 'string' &&
        /^(businessDate|birthDate|dateFrom|dateTo|date)$/.test(name)
      ) {
        property.format ??= 'date';
        property.pattern ??= calendarDatePattern;
      }
    }
  }
  for (const [pathName, path] of Object.entries(document.paths)) {
    for (const operation of Object.values(path ?? {})) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('parameters' in operation)
      )
        continue;
      const operationId = operation.operationId ?? '';
      if (operationRules[operationId]) {
        operation.description =
          `${operation.description ?? ''}${operationRules[operationId]}`.trim();
      }
      if (inactiveListOperations.has(operationId)) {
        operation.description =
          `${operation.description ?? ''} Sans isActive, seules les ressources actives sont retournées ; isActive=false permet aux administrateurs de retrouver les ressources désactivées.`.trim();
      }
      if (inactiveDirectPath.test(pathName)) {
        operation.description =
          `${operation.description ?? ''} L’accès direct par identifiant reste possible quel que soit l’état actif ou désactivé de la ressource ; un PATCH avec isActive=true permet sa réactivation.`.trim();
      }
      operation.parameters = (operation.parameters ?? []).filter(
        (parameter: ParameterObject | ReferenceObject) => {
          if ('$ref' in parameter) return true;
          parameter.description ??=
            parameterDescriptions[parameter.name] ??
            `Valeur du paramètre « ${humanize(parameter.name)} ».`;
          if (/Id$/.test(parameter.name))
            parameter.schema = {
              ...parameter.schema,
              type: 'integer',
              minimum: 1,
            };
          if (parameter.name === 'sort') {
            const fields = sortFields[operation.operationId ?? ''];
            if (!fields) return false;
            parameter.schema = {
              type: 'string',
              enum: fields.flatMap((field) => [
                `${field}:asc`,
                `${field}:desc`,
              ]),
            };
          }
          if (
            parameter.in === 'query' &&
            /^(businessDate|dateFrom|dateTo|date)$/.test(parameter.name)
          ) {
            parameter.schema = {
              ...parameter.schema,
              type: 'string',
              format: 'date',
              pattern: calendarDatePattern,
            };
          }
          if (parameter.name === 'queueIds') {
            parameter.schema = {
              ...parameter.schema,
              type: 'string',
              pattern: '^\\d+(?:\\s*,\\s*\\d+)*$',
              example: '1,2,3',
            };
          }
          return true;
        },
      );
    }
  }
  const publicContracts: Record<
    string,
    { security: Array<Record<string, never[]>>; keepErrors: string[] }
  > = {
    AuthController_login: {
      security: [],
      keepErrors: ['400', '401', '429', '500'],
    },
    AuthController_refresh: {
      security: [{ 'refresh-cookie': [] }, {}],
      keepErrors: ['400', '401', '429', '500'],
    },
    RegistrationsController_getPublicPosition: {
      security: [{ 'registration-token': [] }],
      keepErrors: ['400', '401', '410', '429', '500'],
    },
    NotificationsController_handleWebhook: {
      security: [],
      keepErrors: ['400', '401', '429', '500'],
    },
    TranslationsController_getBundle: {
      security: [],
      keepErrors: ['304', '400', '429', '500'],
    },
  };
  for (const path of Object.values(document.paths)) {
    for (const operation of Object.values(path ?? {})) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('responses' in operation)
      )
        continue;
      const contract = publicContracts[operation.operationId ?? ''];
      if (!contract) continue;
      operation.security = contract.security;
      if (
        operation.operationId === 'RegistrationsController_getPublicPosition' &&
        !operation.responses['410']
      ) {
        operation.responses['410'] = {
          description: 'Jeton de suivi expiré',
          content: operation.responses['401']?.content,
        };
      }
      for (const status of Object.keys(operation.responses)) {
        if (/^[45]/.test(status) && !contract.keepErrors.includes(status)) {
          delete operation.responses[status];
        }
      }
    }
  }
  return document;
}
