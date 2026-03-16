# Test QR Codes for Logistics Testing

## 11 Test Teams Available

All teams have been reset to **NOT_MARKED** attendance status for fresh testing:

### Team Details

| Team Code | Team Name | Track | College | Attendance | Present Members |
|-----------|-----------|-------|---------|------------|----------------|
| IS-TEST1 | Alpha Innovators | IDEA_SPRINT | IIT Delhi | NOT_MARKED | 0/4 |
| BS-TEST2 | Beta Builders | BUILD_STORM | IIT Bombay | NOT_MARKED | 0/4 |
| IS-TEST3 | Gamma Creators | IDEA_SPRINT | NIT Trichy | NOT_MARKED | 0/4 |
| BS-TEST4 | Delta Developers | BUILD_STORM | BITS Pilani | NOT_MARKED | 0/4 |
| IS-TEST5 | Epsilon Explorers | IDEA_SPRINT | IIT Madras | NOT_MARKED | 0/4 |
| BS-TEST6 | Zeta Zealots | BUILD_STORM | NIT Warangal | NOT_MARKED | 0/4 |
| IS-TEST7 | Eta Engineers | IDEA_SPRINT | IIIT Hyderabad | NOT_MARKED | 0/4 |
| BS-TEST8 | Theta Titans | BUILD_STORM | DTU Delhi | NOT_MARKED | 0/4 |
| IS-DEMO1 | Team Quantum | IDEA_SPRINT | IIT Bombay | NOT_MARKED | 0/4 |
| BS-DEMO2 | NexGen Builders | BUILD_STORM | NIT Trichy | NOT_MARKED | 0/4 |
| IS-DEMO3 | Innovate Squad | IDEA_SPRINT | BITS Pilani | NOT_MARKED | 0/4 |

### Attendance Summary
- **Present Teams**: 0
- **Absent Teams**: 0  
- **Partial Teams**: 0
- **Not Marked Teams**: 11
- **Total Present Users**: 0/44 (0.0%)

## QR Code URLs for Testing

You can use these URLs to test QR scanning functionality:

### Legacy Format QR Codes (for testing backward compatibility)
```
IS-TEST1    BS-TEST2    IS-TEST3    BS-TEST4
IS-TEST5    BS-TEST6    IS-TEST7    BS-TEST8
IS-DEMO1    BS-DEMO2    IS-DEMO3
```

### URL Format QR Codes
```
https://www.indianexthackthon.online/checkin?code=IS-TEST1
https://www.indianexthackthon.online/checkin?code=BS-TEST2
https://www.indianexthackthon.online/checkin?code=IS-TEST3
https://www.indianexthackthon.online/checkin?code=BS-TEST4
https://www.indianexthackthon.online/checkin?code=IS-TEST5
https://www.indianexthackthon.online/checkin?code=BS-TEST6
https://www.indianexthackthon.online/checkin?code=IS-TEST7
https://www.indianexthackthon.online/checkin?code=BS-TEST8
https://www.indianexthackthon.online/checkin?code=IS-DEMO1
https://www.indianexthackthon.online/checkin?code=BS-DEMO2
https://www.indianexthackthon.online/checkin?code=IS-DEMO3
```

## Testing Scenarios

### 1. Admin Dashboard Testing
- Open `/admin` to see attendance statistics
- Should show: 12 present users, 2 present teams, 37.5% attendance rate

### 2. Logistics Dashboard Testing
- Open `/admin/logistics` to see all approved teams
- Filter by attendance status (Present, Absent, Partial, Not Marked)
- Test QR scanning with the codes above

### 3. QR Scanner Testing
- Use logistics QR scanner to scan team codes
- Test both legacy format (plain codes) and URL format
- Verify real-time notifications appear

### 4. Team Detail Testing
- Click on any team to see individual member attendance
- Test checking in individual members
- Test team-level attendance changes

## Clean Up

To remove test data, run:
```bash
npx tsx prisma/seed-logistics-teams.ts
```

The script automatically cleans up previous test data before creating new teams.