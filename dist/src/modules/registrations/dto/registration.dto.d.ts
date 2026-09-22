import { CreatePersonDto } from '../../persons/dto/person.dto';
export declare class CreateRegistrationDto {
    personId?: number;
    person?: CreatePersonDto;
    queueId: number;
    tierId: number;
    entryType: string;
    scheduledTime?: string;
}
export declare class RescheduleAppointmentDto {
    scheduledTime: string;
}
export declare class UpdateRegistrationDto {
    tierId?: number;
    languagePreference?: string;
}
