/*
 * Copyright 2022-2023 Chaos Meta Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <sys/types.h>
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <fcntl.h>
#include <getopt.h>
#include <signal.h>

int set_env(int pid) {
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "cat /proc/%d/environ | tr '\\0' '\\t'", pid);

    FILE* pipe = popen(cmd, "r");
    if (pipe == NULL) {
        fprintf(stderr, "Failed to execute command: %s\n", cmd);
        return -1;
    }

    char env_data[4096];
    fgets(env_data, sizeof(env_data), pipe);
    pclose(pipe);

    char* tmp;
    int length = strlen(env_data);
    tmp = (char*)malloc(length + 1);
    strcpy(tmp, env_data);

    char* env_var;
    env_var = strtok(tmp, "\t");
    while (env_var != NULL) {
        if (putenv(env_var) != 0) {
            fprintf(stderr, "failed to set environment variable[%s].\n", env_var);
            return -1;
        }
        env_var = strtok(NULL, "\t");
    }

    return 0;
}

int enter_ns(int pid, const char* type) {
    char path[64], selfpath[64];
    snprintf(path, sizeof(path), "/proc/%d/ns/%s", pid, type);
    snprintf(selfpath, sizeof(selfpath), "/proc/self/ns/%s", type);

    struct stat oldns_stat, newns_stat;
    int oldre = stat(selfpath, &oldns_stat);
    int newre = stat(path, &newns_stat);
    if (oldre != 0) {
        fprintf(stderr, "stat self namespace file[%s] error\n", selfpath);
        return oldre;
    }

    if (newre != 0) {
        fprintf(stderr, "stat target namespace file[%s] error\n", path);
        return oldre;
    }

    if (oldns_stat.st_ino != newns_stat.st_ino) {
        int newns = open(path, O_RDONLY);
        if (newns < 0) {
            fprintf(stderr, "open target file[%s] error\n", path);
            return newns;
        }

        int result = syscall(__NR_setns, newns, 0);
        close(newns);
        if (result != 0) {
            fprintf(stderr, "setns error\n");
            return result;
        }
    }

    return 0;
}

int main(int argc, char *argv[]) {
    int ret = kill(getpid(), SIGSTOP);
    if (ret != 0) {
        fprintf(stderr, "stop process error\n");
        return ret;
    }

    int opt;
    char *cmd;
    int target = 0;
    int ipcns = 0;
    int utsns = 0;
    int netns = 0;
    int pidns = 0;
    int mntns = 0;
    int envns = 0;
    char *string = "c:t:mpunie";

    while((opt =getopt(argc, argv, string))!= -1) {
        switch (opt) {
            case 'c':
                cmd = optarg;
                break;
            case 't':
                target = atoi(optarg);
                break;
            case 'm':
                mntns = 1;
                break;
            case 'p':
                pidns = 1;
                break;
            case 'u':
                utsns = 1;
                break;
            case 'n':
                netns = 1;
                break;
            case 'i':
                ipcns = 1;
                break;
            case 'e':
                envns = 1;
                break;
            default:
                break;
        }
    }

    if (target <= 0) {
        fprintf(stderr, "%s is not a valid process ID\n", target);
        return 1;
    }

    if (!cmd) {
        fprintf(stderr, "cmd args is empty\n");
        return 1;
    }

    if(envns) {
        int re = set_env(target);
        if (re != 0) {
            return re;
        }
    }

    if(ipcns) {
        int re = enter_ns(target, "ipc");
        if (re != 0) {
            return re;
        }
    }

    if(utsns) {
        int re = enter_ns(target, "uts");
        if (re != 0) {
            return re;
        }
    }

    if(netns) {
        int re = enter_ns(target, "net");
        if (re != 0) {
            return re;
        }
    }

    if(pidns) {
        int re = enter_ns(target, "pid");
        if (re != 0) {
            return re;
        }
    }

    if(mntns) {
        int re = enter_ns(target, "mnt");
        if (re != 0) {
            return re;
        }
    }

    int cmdlen = (int)strlen(cmd);
    int rawlen = cmdlen * 3/4;
    char *raw = (char *)malloc(rawlen * sizeof(char));
    int decoderes = base64_decode(cmd, cmdlen, raw, &rawlen);
    if (decoderes != 0) {
        fprintf(stderr, "decode cmd error\n");
        return decoderes;
    }

    int re = system(raw);
    re = (re >> 8) & 0xFF;
    if (re != 0) {
//        fprintf(stderr, "cmd exec error， exit code: %d\n", re);
        return re;
    }

    return 0;
}

static const char base64_alphabet[] = {
    'A', 'B', 'C', 'D', 'E', 'F', 'G',
    'H', 'I', 'J', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g',
    'h', 'i', 'j', 'k', 'l', 'm', 'n',
    'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '+', '/'};

static const unsigned char base64_suffix_map[256] = {
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 253, 255,
    255, 253, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 253, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255,  62, 255, 255, 255,  63,
    52,  53,  54,  55,  56,  57,  58,  59,  60,  61, 255, 255,
    255, 254, 255, 255, 255,   0,   1,   2,   3,   4,   5,   6,
    7,   8,   9,  10,  11,  12,  13,  14,  15,  16,  17,  18,
    19,  20,  21,  22,  23,  24,  25, 255, 255, 255, 255, 255,
    255,  26,  27,  28,  29,  30,  31,  32,  33,  34,  35,  36,
    37,  38,  39,  40,  41,  42,  43,  44,  45,  46,  47,  48,
    49,  50,  51, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255 };

static char cmove_bits(unsigned char src, unsigned lnum, unsigned rnum) {
    src <<= lnum;
    src >>= rnum;
    return src;
}

int base64_decode(const char *indata, int inlen, char *outdata, int *outlen) {

    int ret = 0;
    if (indata == NULL || inlen <= 0 || outdata == NULL || outlen == NULL) {
        return ret = -1;
    }
    if (inlen % 4 != 0) {
        return ret = -2;
    }

    int t = 0, x = 0, y = 0, i = 0;
    unsigned char c = 0;
    int g = 3;

    while (x < inlen) {
        c = base64_suffix_map[indata[x++]];
        if (c == 255) return -1;
        if (c == 253) continue;
        if (c == 254) { c = 0; g--; }
        t = (t<<6) | c;
        if (++y == 4) {
            outdata[i++] = (unsigned char)((t>>16)&0xff);
            if (g > 1) outdata[i++] = (unsigned char)((t>>8)&0xff);
            if (g > 2) outdata[i++] = (unsigned char)(t&0xff);
            y = t = 0;
        }
    }
    if (outlen != NULL) {
        *outlen = i;
    }
    return ret;
}