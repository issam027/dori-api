import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import type {
  ParameterObject,
  ReferenceObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Single source of truth for the served and exported OpenAPI documents. */
export function createOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Dori API')
    .setDescription(
      "Spécification de référence de la plateforme de gestion de files d'attente et de rendez-vous Dori",
    )
    .setVersion('1.0')
    .setContact(
      'Dori Support',
      'https://dori.example.com',
      'support@dori.example.com',
    )
    .setLicense('Propriétaire', 'https://dori.com/license')
    .addServer('http://localhost:3000', 'Environnement local de développement')
    .addServer('https://dori-api-dev.vercel.app', 'Environnement distant de développement')
    .addServer('https://dori-api.vercel.app/', 'Dori API Vercel')
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
}

/** Applies scalar conventions that cannot drift between individual DTOs. */
export function normalizeOpenApiDocument(
  document: OpenAPIObject,
): OpenAPIObject {
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
      if (!property || '$ref' in property) continue;
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
    }
  }
  for (const path of Object.values(document.paths)) {
    for (const operation of Object.values(path ?? {})) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('parameters' in operation)
      )
        continue;
      operation.parameters = (operation.parameters ?? []).filter(
        (parameter: ParameterObject | ReferenceObject) => {
          if ('$ref' in parameter) return true;
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
          return true;
        },
      );
    }
  }
  return document;
}
