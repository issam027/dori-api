"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueOperatorAssignmentResponseDto = exports.QueueOperatorDto = exports.QueueThreadsResponseDto = exports.QueueThreadDto = exports.QueueThreadSessionDto = exports.QueueStatusResponseDto = exports.NextAppointmentDto = exports.QueueResponseDto = exports.ConfigFieldDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class ConfigFieldDto {
    value;
    source;
    static _OPENAPI_METADATA_FACTORY() {
        return { value: { required: true }, source: { required: true, enum: ["inherited", "overridden"] } };
    }
}
exports.ConfigFieldDto = ConfigFieldDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15, description: 'Valeur effective du paramètre' }),
    __metadata("design:type", Object)
], ConfigFieldDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'inherited', enum: ['inherited', 'overridden'], description: 'Origine de la valeur (§4.5)' }),
    __metadata("design:type", String)
], ConfigFieldDto.prototype, "source", void 0);
class QueueResponseDto {
    queueId;
    queueCode;
    siteId;
    queueName;
    averageWaitTime;
    threadCount;
    appointmentsEnabled;
    appointmentSlotDuration;
    slotCapacity;
    workingHoursStart;
    workingHoursEnd;
    breakStart;
    breakEnd;
    lateToleranceMinutes;
    baseWeightWalkin;
    baseWeightAppointment;
    escalationRateWalkin;
    escalationRateAppointment;
    carryOverWaiting;
    dailyResetMode;
    dailyResetTime;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, queueCode: { required: true, type: () => String }, siteId: { required: true, type: () => Number }, queueName: { required: false, type: () => String, nullable: true }, averageWaitTime: { required: true, type: () => Number }, threadCount: { required: true, type: () => Number }, appointmentsEnabled: { required: true }, appointmentSlotDuration: { required: true }, slotCapacity: { required: true }, workingHoursStart: { required: true }, workingHoursEnd: { required: true }, breakStart: { required: true }, breakEnd: { required: true }, lateToleranceMinutes: { required: true }, baseWeightWalkin: { required: true }, baseWeightAppointment: { required: true }, escalationRateWalkin: { required: true }, escalationRateAppointment: { required: true }, carryOverWaiting: { required: true }, dailyResetMode: { required: true }, dailyResetTime: { required: true } };
    }
}
exports.QueueResponseDto = QueueResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], QueueResponseDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueResponseDto.prototype, "siteId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Médecine Générale', nullable: true }),
    __metadata("design:type", Object)
], QueueResponseDto.prototype, "queueName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10 }),
    __metadata("design:type", Number)
], QueueResponseDto.prototype, "averageWaitTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], QueueResponseDto.prototype, "threadCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "appointmentsEnabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "appointmentSlotDuration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "slotCapacity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "workingHoursStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "workingHoursEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "breakStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "breakEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "lateToleranceMinutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "baseWeightWalkin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "baseWeightAppointment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "escalationRateWalkin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "escalationRateAppointment", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "carryOverWaiting", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "dailyResetMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ConfigFieldDto }),
    __metadata("design:type", ConfigFieldDto)
], QueueResponseDto.prototype, "dailyResetTime", void 0);
class NextAppointmentDto {
    customerId;
    ticketNumber;
    scheduledTime;
    appointmentStatus;
    status;
    static _OPENAPI_METADATA_FACTORY() {
        return { customerId: { required: true, type: () => Number }, ticketNumber: { required: true, type: () => String }, scheduledTime: { required: false, type: () => Date, nullable: true }, appointmentStatus: { required: false, type: () => String, nullable: true }, status: { required: true, type: () => String } };
    }
}
exports.NextAppointmentDto = NextAppointmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 101 }),
    __metadata("design:type", Number)
], NextAppointmentDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-012' }),
    __metadata("design:type", String)
], NextAppointmentDto.prototype, "ticketNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-20T10:30:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], NextAppointmentDto.prototype, "scheduledTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'booked', nullable: true }),
    __metadata("design:type", Object)
], NextAppointmentDto.prototype, "appointmentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'waiting' }),
    __metadata("design:type", String)
], NextAppointmentDto.prototype, "status", void 0);
class QueueStatusResponseDto {
    queueId;
    queueCode;
    waitingCount;
    activeThreadsCount;
    totalThreads;
    estimatedWaitMinutes;
    nextAppointments;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, queueCode: { required: true, type: () => String }, waitingCount: { required: true, type: () => Number }, activeThreadsCount: { required: true, type: () => Number }, totalThreads: { required: true, type: () => Number }, estimatedWaitMinutes: { required: true, type: () => Number }, nextAppointments: { required: true, type: () => [require("./queue-response.dto").NextAppointmentDto] } };
    }
}
exports.QueueStatusResponseDto = QueueStatusResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueStatusResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'MED-01' }),
    __metadata("design:type", String)
], QueueStatusResponseDto.prototype, "queueCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5, description: "Nombre de clients en attente aujourd'hui" }),
    __metadata("design:type", Number)
], QueueStatusResponseDto.prototype, "waitingCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Nombre de guichets actuellement connectés' }),
    __metadata("design:type", Number)
], QueueStatusResponseDto.prototype, "activeThreadsCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3, description: 'Nombre total de guichets configurés' }),
    __metadata("design:type", Number)
], QueueStatusResponseDto.prototype, "totalThreads", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25, description: "Temps d'attente estimé en minutes" }),
    __metadata("design:type", Number)
], QueueStatusResponseDto.prototype, "estimatedWaitMinutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [NextAppointmentDto], description: 'Prochains rendez-vous planifiés' }),
    __metadata("design:type", Array)
], QueueStatusResponseDto.prototype, "nextAppointments", void 0);
class QueueThreadSessionDto {
    sessionId;
    userId;
    username;
    connectedAt;
    lastSeenAt;
    inactiveMinutes;
    currentRegistrationId;
    static _OPENAPI_METADATA_FACTORY() {
        return { sessionId: { required: true, type: () => Number }, userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, connectedAt: { required: true, type: () => String }, lastSeenAt: { required: true, type: () => String }, inactiveMinutes: { required: true, type: () => Number }, currentRegistrationId: { required: false, type: () => Number, nullable: true } };
    }
}
exports.QueueThreadSessionDto = QueueThreadSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 12 }),
    __metadata("design:type", Number)
], QueueThreadSessionDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], QueueThreadSessionDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'agent1' }),
    __metadata("design:type", String)
], QueueThreadSessionDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", String)
], QueueThreadSessionDto.prototype, "connectedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T09:30:00.000Z' }),
    __metadata("design:type", String)
], QueueThreadSessionDto.prototype, "lastSeenAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2, description: 'Minutes depuis la dernière activité' }),
    __metadata("design:type", Number)
], QueueThreadSessionDto.prototype, "inactiveMinutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 42, nullable: true, description: 'ID de l’inscription en cours de traitement' }),
    __metadata("design:type", Object)
], QueueThreadSessionDto.prototype, "currentRegistrationId", void 0);
class QueueThreadDto {
    threadNumber;
    status;
    session;
    static _OPENAPI_METADATA_FACTORY() {
        return { threadNumber: { required: true, type: () => Number }, status: { required: true, type: () => String }, session: { required: true, type: () => require("./queue-response.dto").QueueThreadSessionDto, nullable: true } };
    }
}
exports.QueueThreadDto = QueueThreadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'Numéro physique du guichet' }),
    __metadata("design:type", Number)
], QueueThreadDto.prototype, "threadNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'occupied', enum: ['free', 'occupied'] }),
    __metadata("design:type", String)
], QueueThreadDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: QueueThreadSessionDto, nullable: true }),
    __metadata("design:type", Object)
], QueueThreadDto.prototype, "session", void 0);
class QueueThreadsResponseDto {
    queueId;
    threadCount;
    threads;
    static _OPENAPI_METADATA_FACTORY() {
        return { queueId: { required: true, type: () => Number }, threadCount: { required: true, type: () => Number }, threads: { required: true, type: () => [require("./queue-response.dto").QueueThreadDto] } };
    }
}
exports.QueueThreadsResponseDto = QueueThreadsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueThreadsResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3 }),
    __metadata("design:type", Number)
], QueueThreadsResponseDto.prototype, "threadCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [QueueThreadDto] }),
    __metadata("design:type", Array)
], QueueThreadsResponseDto.prototype, "threads", void 0);
class QueueOperatorDto {
    userId;
    username;
    email;
    userType;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, username: { required: true, type: () => String }, email: { required: false, type: () => String, nullable: true }, userType: { required: true, type: () => String } };
    }
}
exports.QueueOperatorDto = QueueOperatorDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], QueueOperatorDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'agent1' }),
    __metadata("design:type", String)
], QueueOperatorDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'agent1@dori.tn', nullable: true }),
    __metadata("design:type", Object)
], QueueOperatorDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'human', enum: ['human', 'kiosk'] }),
    __metadata("design:type", String)
], QueueOperatorDto.prototype, "userType", void 0);
class QueueOperatorAssignmentResponseDto {
    userId;
    queueId;
    assignedAt;
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => Number }, queueId: { required: true, type: () => Number }, assignedAt: { required: true, type: () => Date } };
    }
}
exports.QueueOperatorAssignmentResponseDto = QueueOperatorAssignmentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5 }),
    __metadata("design:type", Number)
], QueueOperatorAssignmentResponseDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], QueueOperatorAssignmentResponseDto.prototype, "queueId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-20T08:00:00.000Z' }),
    __metadata("design:type", Date)
], QueueOperatorAssignmentResponseDto.prototype, "assignedAt", void 0);
//# sourceMappingURL=queue-response.dto.js.map