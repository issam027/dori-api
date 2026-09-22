export declare class PersonResponseDto {
    personId: number;
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneNumber: string;
    birthDate?: Date | null;
    languagePreference: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class NoteAuthorDto {
    userId: number;
    username: string;
}
export declare class PersonNoteResponseDto {
    noteId: number;
    personId: number;
    content: string;
    isActive: boolean;
    createdByUser: NoteAuthorDto;
    updatedByUser?: NoteAuthorDto | null;
    createdAt: Date;
    updatedAt: Date;
}
