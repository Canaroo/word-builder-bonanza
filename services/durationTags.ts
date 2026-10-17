import { DurationTag } from '../types';

export function labelize(tag: DurationTag): string {
    switch (tag) {
        case 'PERSISTENT':
            return ' • PERSISTENT';
        case 'ONE_TIME':
            return ' • ONE-TIME';
        case 'LIMITED':
            return ' • LIMITED';
        default:
            return '';
    }
}
